import { Client } from "@microsoft/microsoft-graph-client";
import { prisma } from "./db";
import { decrypt, encrypt } from "./encryption";

// ─── Environment ────────────────────────────────────────────────────
const AZURE_AD_CLIENT_ID = process.env.AZURE_AD_CLIENT_ID!;
const AZURE_AD_CLIENT_SECRET = process.env.AZURE_AD_CLIENT_SECRET!;
const AZURE_AD_TENANT_ID = process.env.AZURE_AD_TENANT_ID!;

const TOKEN_URL = `https://login.microsoftonline.com/${AZURE_AD_TENANT_ID}/oauth2/v2.0/token`;
const SCOPES = "https://graph.microsoft.com/.default offline_access";

// ─── Retry helper with exponential backoff ──────────────────────────

interface GraphApiCallOptions {
  userId: string;
  /** Description for error messages */
  operation: string;
}

async function graphApiCall<T>(
  fn: (client: Client) => Promise<T>,
  opts: GraphApiCallOptions,
): Promise<T> {
  const MAX_RETRIES = 3;
  const BASE_DELAY_MS = 1000;

  let lastError: Error | null = null;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const client = await getGraphClient(opts.userId);
      return await fn(client);
    } catch (error: unknown) {
      lastError = error instanceof Error ? error : new Error(String(error));

      const statusCode = (error as { statusCode?: number }).statusCode;

      // 429 Too Many Requests — respect Retry-After header
      if (statusCode === 429) {
        const retryAfter = (error as { headers?: Record<string, string> })
          .headers?.["retry-after"];
        const waitMs = retryAfter
          ? parseInt(retryAfter, 10) * 1000
          : BASE_DELAY_MS * Math.pow(2, attempt);
        console.warn(
          `[outlook] 429 on ${opts.operation}, retrying in ${waitMs}ms (attempt ${attempt + 1}/${MAX_RETRIES})`,
        );
        await sleep(waitMs);
        continue;
      }

      // 401 Unauthorized — force token refresh and retry once
      if (statusCode === 401 && attempt === 0) {
        console.warn(
          `[outlook] 401 on ${opts.operation}, refreshing token and retrying`,
        );
        await refreshAccessToken(opts.userId);
        continue;
      }

      // Other errors — exponential backoff
      if (attempt < MAX_RETRIES - 1) {
        const waitMs = BASE_DELAY_MS * Math.pow(2, attempt);
        console.warn(
          `[outlook] Error on ${opts.operation} (${statusCode ?? "unknown"}), retrying in ${waitMs}ms (attempt ${attempt + 1}/${MAX_RETRIES})`,
        );
        await sleep(waitMs);
        continue;
      }
    }
  }

  throw new Error(
    `[outlook] ${opts.operation} failed after ${MAX_RETRIES} attempts: ${lastError?.message}`,
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─── Token management ───────────────────────────────────────────────

async function refreshAccessToken(userId: string): Promise<string> {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { microsoftRefreshToken: true },
  });

  if (!user.microsoftRefreshToken) {
    throw new Error(
      `[outlook] No refresh token stored for user ${userId}. User must re-authenticate.`,
    );
  }

  const refreshToken = decrypt(user.microsoftRefreshToken);

  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: AZURE_AD_CLIENT_ID,
      client_secret: AZURE_AD_CLIENT_SECRET,
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      scope: SCOPES,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `[outlook] Token refresh failed (${response.status}): ${body}`,
    );
  }

  const data = (await response.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
  };

  const newExpiry = new Date(Date.now() + data.expires_in * 1000);

  // Encrypt and persist the new tokens
  const encryptedAccess = encrypt(data.access_token);
  const updateData: {
    microsoftAccessToken: string;
    tokenExpiry: Date;
    microsoftRefreshToken?: string;
  } = {
    microsoftAccessToken: encryptedAccess,
    tokenExpiry: newExpiry,
  };

  // Microsoft may issue a new refresh token — always store it if present
  if (data.refresh_token) {
    updateData.microsoftRefreshToken = encrypt(data.refresh_token);
  }

  await prisma.user.update({
    where: { id: userId },
    data: updateData,
  });

  return data.access_token;
}

// ─── Graph client factory ───────────────────────────────────────────

export async function getGraphClient(userId: string): Promise<Client> {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: {
      microsoftAccessToken: true,
      microsoftRefreshToken: true,
      tokenExpiry: true,
    },
  });

  let accessToken: string;

  // Check if we have a cached access token that is still valid (with 5-min buffer)
  const bufferMs = 5 * 60 * 1000;
  if (
    user.microsoftAccessToken &&
    user.tokenExpiry &&
    user.tokenExpiry.getTime() > Date.now() + bufferMs
  ) {
    accessToken = decrypt(user.microsoftAccessToken);
  } else {
    // Token expired or missing — refresh it
    accessToken = await refreshAccessToken(userId);
  }

  return Client.init({
    authProvider: (done) => {
      done(null, accessToken);
    },
  });
}

// ─── Email operations ───────────────────────────────────────────────

/**
 * Creates a draft email in the user's Outlook mailbox.
 */
export async function createDraft(
  userId: string,
  to: string,
  subject: string,
  bodyHtml: string,
  fromAddress?: string,
): Promise<{ draftId: string; messageId: string }> {
  return graphApiCall(
    async (client) => {
      const messagePayload: Record<string, unknown> = {
        "@odata.type": "#microsoft.graph.message",
        subject,
        body: {
          contentType: "HTML",
          content: bodyHtml,
        },
        toRecipients: [
          {
            emailAddress: { address: to },
          },
        ],
      };

      if (fromAddress) {
        messagePayload.from = {
          emailAddress: { address: fromAddress },
        };
      }

      const draft = await client.api("/me/messages").post(messagePayload);

      return {
        draftId: draft.id as string,
        messageId: draft.internetMessageId as string,
      };
    },
    { userId, operation: "createDraft" },
  );
}

/**
 * Sends an existing draft and returns conversation metadata.
 */
export async function sendDraft(
  userId: string,
  draftId: string,
): Promise<{ conversationId: string; internetMessageId: string }> {
  return graphApiCall(
    async (client) => {
      // Send the draft
      await client.api(`/me/messages/${draftId}/send`).post({});

      // Wait briefly for the message to appear in Sent Items
      await sleep(1500);

      // Fetch the sent message from Sent Items to get conversation metadata
      const sentMessages = await client
        .api("/me/mailFolders/SentItems/messages")
        .filter(`internetMessageId eq '${draftId}'`)
        .top(1)
        .orderby("sentDateTime desc")
        .select("id,conversationId,internetMessageId")
        .get();

      if (sentMessages.value && sentMessages.value.length > 0) {
        const msg = sentMessages.value[0];
        return {
          conversationId: msg.conversationId as string,
          internetMessageId: msg.internetMessageId as string,
        };
      }

      // Fallback: search by most recent sent message
      const fallback = await client
        .api("/me/mailFolders/SentItems/messages")
        .top(1)
        .orderby("sentDateTime desc")
        .select("id,conversationId,internetMessageId")
        .get();

      if (fallback.value && fallback.value.length > 0) {
        const msg = fallback.value[0];
        return {
          conversationId: msg.conversationId as string,
          internetMessageId: msg.internetMessageId as string,
        };
      }

      throw new Error(
        "[outlook] Could not find sent message after sending draft",
      );
    },
    { userId, operation: "sendDraft" },
  );
}

/**
 * Sends an email directly (no draft step).
 */
export async function sendEmail(
  userId: string,
  to: string,
  subject: string,
  bodyHtml: string,
): Promise<{ conversationId: string; internetMessageId: string }> {
  return graphApiCall(
    async (client) => {
      await client.api("/me/sendMail").post({
        message: {
          subject,
          body: {
            contentType: "HTML",
            content: bodyHtml,
          },
          toRecipients: [
            {
              emailAddress: { address: to },
            },
          ],
        },
        saveToSentItems: true,
      });

      // Wait briefly for the message to appear in Sent Items
      await sleep(1500);

      // Fetch the most recent sent message to get its metadata
      const sentMessages = await client
        .api("/me/mailFolders/SentItems/messages")
        .top(1)
        .orderby("sentDateTime desc")
        .select("id,conversationId,internetMessageId")
        .get();

      if (sentMessages.value && sentMessages.value.length > 0) {
        const msg = sentMessages.value[0];
        return {
          conversationId: msg.conversationId as string,
          internetMessageId: msg.internetMessageId as string,
        };
      }

      throw new Error(
        "[outlook] Could not find sent message in Sent Items after sendMail",
      );
    },
    { userId, operation: "sendEmail" },
  );
}

// ─── Conversation / Reply tracking ─────────────────────────────────

/**
 * Gets recent replies in a conversation thread (messages NOT from the user).
 */
export async function getRecentReplies(
  userId: string,
  conversationId: string,
): Promise<
  Array<{ id: string; from: string; body: string; receivedAt: Date }>
> {
  return graphApiCall(
    async (client) => {
      // Get the user's email to filter out their own messages
      const me = await client.api("/me").select("mail,userPrincipalName").get();
      const userEmail = (
        (me.mail as string) || (me.userPrincipalName as string)
      ).toLowerCase();

      // Note: conversationId filter + orderby is not supported by Graph API
      // ("The restriction or sort order is too complex"), so we sort client-side
      const messages = await client
        .api("/me/messages")
        .filter(`conversationId eq '${conversationId}'`)
        .top(20)
        .select("id,from,body,receivedDateTime")
        .get();

      if (!messages.value) return [];

      return (messages.value as Array<Record<string, unknown>>)
        .filter((msg) => {
          const fromEmail = (
            (msg.from as Record<string, Record<string, string>>)?.emailAddress
              ?.address ?? ""
          ).toLowerCase();
          return fromEmail !== userEmail;
        })
        .map((msg) => ({
          id: msg.id as string,
          from: (msg.from as Record<string, Record<string, string>>)
            ?.emailAddress?.address as string,
          body: (msg.body as Record<string, string>)?.content as string,
          receivedAt: new Date(msg.receivedDateTime as string),
        }))
        .sort((a, b) => b.receivedAt.getTime() - a.receivedAt.getTime());
    },
    { userId, operation: "getRecentReplies" },
  );
}

// ─── Bounce Detection ───────────────────────────────────────────────

/**
 * Scans the user's inbox for recent Non-Delivery Reports (NDRs).
 * Returns the bounced recipient email addresses extracted from NDR bodies.
 */
export async function getRecentBounces(
  userId: string,
  since: Date,
): Promise<string[]> {
  return graphApiCall(
    async (client) => {
      const sinceStr = since.toISOString();

      // Search for NDR/undeliverable messages by subject
      // NDR senders vary (postmaster@, MicrosoftExchange...@domain, etc.)
      // so searching by subject "Undeliverable" is more reliable
      const messages = await client
        .api("/me/messages")
        .filter(
          `receivedDateTime ge ${sinceStr} and startsWith(subject, 'Undeliverable')`,
        )
        .top(50)
        .select("id,body,toRecipients,receivedDateTime")
        .get();

      if (!messages.value) return [];

      const bouncedEmails: string[] = [];

      for (const msg of messages.value as Array<Record<string, unknown>>) {
        const body = (msg.body as Record<string, string>)?.content ?? "";
        const bodyLower = body.toLowerCase();

        // Confirm this is an NDR (not just any postmaster message)
        const isNdr =
          bodyLower.includes("undeliverable") ||
          bodyLower.includes("delivery has failed") ||
          bodyLower.includes("couldn't be delivered") ||
          bodyLower.includes("could not be delivered") ||
          bodyLower.includes("550 ");

        if (!isNdr) continue;

        // Extract bounced email from the NDR body
        // NDRs typically contain the failed recipient address
        const emailRegex = /[\w.+-]+@[\w-]+\.[\w.-]+/g;
        const foundEmails = body.match(emailRegex) ?? [];

        // Filter out system/sender addresses to find the actual bounced recipient
        const systemPatterns = [
          "postmaster@",
          "mailer-daemon@",
          "ndr@",
          "notify@",
          "microsoftexchange",
          "@outlook.com",  // Skip outlook.com system addresses
          ".prod.outlook.com",  // Internal Exchange server addresses
          "namprd",  // Exchange internal routing addresses
        ];
        // Also get the user's own email to exclude it
        const me = await client.api("/me").select("mail,userPrincipalName").get();
        const userEmail = ((me.mail as string) || (me.userPrincipalName as string)).toLowerCase();

        for (const email of foundEmails) {
          const emailLower = email.toLowerCase();
          if (
            emailLower !== userEmail &&
            !systemPatterns.some((s) => emailLower.includes(s))
          ) {
            bouncedEmails.push(emailLower);
          }
        }
      }

      // Deduplicate
      return [...new Set(bouncedEmails)];
    },
    { userId, operation: "getRecentBounces" },
  );
}

// ─── Calendar ───────────────────────────────────────────────────────

/**
 * Gets free/busy calendar availability for a date range.
 */
export async function getCalendarAvailability(
  userId: string,
  startDate: Date,
  endDate: Date,
): Promise<Array<{ start: string; end: string }>> {
  return graphApiCall(
    async (client) => {
      const events = await client
        .api("/me/calendarView")
        .query({
          startDateTime: startDate.toISOString(),
          endDateTime: endDate.toISOString(),
        })
        .select("start,end,showAs")
        .orderby("start/dateTime")
        .top(50)
        .get();

      if (!events.value) return [];

      // Return busy/tentative slots (not free or unknown)
      return (events.value as Array<Record<string, unknown>>)
        .filter((evt) => evt.showAs === "busy" || evt.showAs === "tentative")
        .map((evt) => ({
          start: (evt.start as Record<string, string>).dateTime,
          end: (evt.end as Record<string, string>).dateTime,
        }));
    },
    { userId, operation: "getCalendarAvailability" },
  );
}

/**
 * Creates a calendar event with an attendee. Returns the event ID.
 */
export async function createCalendarEvent(
  userId: string,
  event: {
    subject: string;
    start: Date;
    end: Date;
    attendeeEmail: string;
  },
): Promise<string> {
  return graphApiCall(
    async (client) => {
      const created = await client.api("/me/events").post({
        subject: event.subject,
        start: {
          dateTime: event.start.toISOString(),
          timeZone: "UTC",
        },
        end: {
          dateTime: event.end.toISOString(),
          timeZone: "UTC",
        },
        attendees: [
          {
            emailAddress: { address: event.attendeeEmail },
            type: "required",
          },
        ],
        isOnlineMeeting: true,
        onlineMeetingProvider: "teamsForBusiness",
      });

      return created.id as string;
    },
    { userId, operation: "createCalendarEvent" },
  );
}
