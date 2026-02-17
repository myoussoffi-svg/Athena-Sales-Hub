import { prisma } from "./db";
import { OutreachStatus } from "@/generated/prisma/client";
import { sendEmail as sendViaOutlook } from "./outlook";
import { sendViaSMTP } from "./smtp";
import { decrypt } from "./encryption";

// ─── Configuration (from env with sensible defaults) ────────────────

const SEND_WINDOW_START = parseInt(
  process.env.SEND_WINDOW_START ?? "8",
  10,
);
const SEND_WINDOW_END = parseInt(
  process.env.SEND_WINDOW_END ?? "18",
  10,
);
const DAILY_EMAIL_LIMIT_PER_DOMAIN = parseInt(
  process.env.DAILY_EMAIL_LIMIT_PER_DOMAIN ?? "20",
  10,
);

// ─── Enqueue ────────────────────────────────────────────────────────

/**
 * Enqueues an outreach email for sending via the job queue.
 */
export async function enqueueEmail(
  outreachId: string,
  priority: number = 0,
): Promise<void> {
  await prisma.jobQueue.create({
    data: {
      type: "send_email",
      payload: { outreachId },
      priority,
      status: "PENDING",
      maxAttempts: 3,
    },
  });
}

// ─── Main processor ─────────────────────────────────────────────────

/**
 * Processes the next pending email job in the queue.
 * Designed to be called repeatedly by a cron job or scheduler.
 */
export async function processEmailQueue(): Promise<void> {
  const now = new Date();

  // Find and claim the next eligible job (atomic update to prevent double-processing)
  const job = await prisma.jobQueue.findFirst({
    where: {
      type: "send_email",
      status: "PENDING",
      runAfter: { lte: now },
    },
    orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
  });

  if (!job) return;

  // Claim the job by setting it to PROCESSING
  const claimed = await prisma.jobQueue.updateMany({
    where: {
      id: job.id,
      status: "PENDING", // Ensures only one worker claims it
    },
    data: {
      status: "PROCESSING",
      startedAt: now,
    },
  });

  // Another worker claimed it first
  if (claimed.count === 0) return;

  const payload = job.payload as { outreachId: string };

  try {
    // 1. Load the outreach record with relations
    const outreach = await prisma.outreach.findUniqueOrThrow({
      where: { id: payload.outreachId },
      include: {
        contact: true,
        sendingDomain: true,
        campaign: true,
        user: true,
      },
    });

    // 2. Pick a sending domain if not already assigned
    let sendingDomainId = outreach.sendingDomainId;
    let sendingDomain = outreach.sendingDomain;

    if (!sendingDomainId && outreach.campaign) {
      const pickedDomainId = await pickSendingDomain(
        outreach.campaign.workspaceId,
      );
      if (pickedDomainId) {
        sendingDomainId = pickedDomainId;
        await prisma.outreach.update({
          where: { id: outreach.id },
          data: { sendingDomainId: pickedDomainId },
        });
        sendingDomain = await prisma.sendingDomain.findUnique({
          where: { id: pickedDomainId },
        });
      }
    }

    // 3. Check daily limit for the sending domain
    if (sendingDomainId) {
      const todaySent = await getDailyDomainSendCount(sendingDomainId);
      const limit = sendingDomain?.dailySendLimit ?? DAILY_EMAIL_LIMIT_PER_DOMAIN;

      if (todaySent >= limit) {
        // Domain is at capacity — reschedule to tomorrow at window start
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(SEND_WINDOW_START, 0, 0, 0);

        await prisma.jobQueue.update({
          where: { id: job.id },
          data: {
            status: "PENDING",
            runAfter: tomorrow,
            startedAt: null,
          },
        });

        console.log(
          `[send-queue] Domain ${sendingDomainId} at daily capacity (${todaySent}/${limit}), rescheduled to ${tomorrow.toISOString()}`,
        );
        return;
      }
    }

    // 4. Check send window (e.g. 8AM-6PM)
    const currentHour = now.getHours();
    if (currentHour < SEND_WINDOW_START || currentHour >= SEND_WINDOW_END) {
      // Outside send window — reschedule to next window opening
      const nextWindow = new Date();
      if (currentHour >= SEND_WINDOW_END) {
        // Past end of window today — schedule for tomorrow morning
        nextWindow.setDate(nextWindow.getDate() + 1);
      }
      nextWindow.setHours(SEND_WINDOW_START, 0, 0, 0);

      await prisma.jobQueue.update({
        where: { id: job.id },
        data: {
          status: "PENDING",
          runAfter: nextWindow,
          startedAt: null,
        },
      });

      console.log(
        `[send-queue] Outside send window (${SEND_WINDOW_START}:00-${SEND_WINDOW_END}:00), rescheduled to ${nextWindow.toISOString()}`,
      );
      return;
    }

    // 5. Send the email
    let messageId: string | undefined;
    let conversationId: string | undefined;

    if (
      sendingDomain &&
      sendingDomain.smtpHost &&
      sendingDomain.smtpUser &&
      sendingDomain.smtpPass
    ) {
      // Send via SMTP (warmup/custom domain)
      const result = await sendViaSMTP(
        {
          host: sendingDomain.smtpHost,
          port: sendingDomain.smtpPort ?? 587,
          user: sendingDomain.smtpUser,
          pass: decrypt(sendingDomain.smtpPass),
        },
        {
          from: sendingDomain.emailAddress,
          fromName: sendingDomain.displayName ?? undefined,
          to: outreach.contact.email,
          subject: outreach.subject ?? "",
          html: outreach.bodyHtml ?? "",
        },
      );
      messageId = result.messageId;
    } else {
      // Send via Outlook (user's primary mailbox)
      const result = await sendViaOutlook(
        outreach.userId,
        outreach.contact.email,
        outreach.subject ?? "",
        outreach.bodyHtml ?? "",
      );
      conversationId = result.conversationId;
      messageId = result.internetMessageId;
    }

    // 6. Update outreach status to SENT
    await prisma.outreach.update({
      where: { id: outreach.id },
      data: {
        status: OutreachStatus.SENT,
        sentAt: now,
        internetMessageId: messageId,
        // Store conversationId on the contact for reply tracking
        ...(conversationId
          ? {
              contact: {
                update: {
                  outlookConversationId: conversationId,
                  lastContactedAt: now,
                },
              },
            }
          : {
              contact: {
                update: {
                  lastContactedAt: now,
                },
              },
            }),
      },
    });

    // 7. Update contact status if it was NEW or RESEARCHED
    if (
      outreach.contact.status === "NEW" ||
      outreach.contact.status === "RESEARCHED"
    ) {
      await prisma.contact.update({
        where: { id: outreach.contactId },
        data: { status: "OUTREACH_STARTED" },
      });
    }

    // 8. Create follow-up outreach records if this is an INITIAL email
    if (outreach.type === "INITIAL" && outreach.campaign) {
      const cadence = outreach.campaign.cadenceConfig as {
        followUp1Days?: number;
        followUp2Days?: number;
      };
      const followUp1Days = cadence.followUp1Days ?? 5;
      const followUp2Days = cadence.followUp2Days ?? 14;

      const followUp1Date = new Date(now);
      followUp1Date.setDate(followUp1Date.getDate() + followUp1Days);
      followUp1Date.setHours(
        SEND_WINDOW_START + Math.floor(Math.random() * 2),
        Math.floor(Math.random() * 60),
        0,
        0,
      );

      const followUp2Date = new Date(now);
      followUp2Date.setDate(followUp2Date.getDate() + followUp2Days);
      followUp2Date.setHours(
        SEND_WINDOW_START + Math.floor(Math.random() * 2),
        Math.floor(Math.random() * 60),
        0,
        0,
      );

      await prisma.outreach.createMany({
        data: [
          {
            contactId: outreach.contactId,
            campaignId: outreach.campaignId,
            userId: outreach.userId,
            sendingDomainId: outreach.sendingDomainId,
            type: "FOLLOWUP_1",
            status: OutreachStatus.SCHEDULED,
            scheduledAt: followUp1Date,
            parentOutreachId: outreach.id,
          },
          {
            contactId: outreach.contactId,
            campaignId: outreach.campaignId,
            userId: outreach.userId,
            sendingDomainId: outreach.sendingDomainId,
            type: "FOLLOWUP_2",
            status: OutreachStatus.SCHEDULED,
            scheduledAt: followUp2Date,
            parentOutreachId: outreach.id,
          },
        ],
      });
    }

    // 9. Mark job as completed
    await prisma.jobQueue.update({
      where: { id: job.id },
      data: {
        status: "COMPLETED",
        completedAt: new Date(),
      },
    });

    console.log(
      `[send-queue] Successfully sent outreach ${outreach.id} to ${outreach.contact.email}`,
    );
  } catch (error) {
    // Handle failure with retry logic
    const errorMessage =
      error instanceof Error ? error.message : String(error);
    const newAttempts = job.attempts + 1;

    if (newAttempts >= job.maxAttempts) {
      // Max retries exhausted — mark as DEAD
      await prisma.jobQueue.update({
        where: { id: job.id },
        data: {
          status: "DEAD",
          attempts: newAttempts,
          lastError: errorMessage,
        },
      });

      // Also mark the outreach as FAILED
      await prisma.outreach.update({
        where: { id: payload.outreachId },
        data: { status: OutreachStatus.FAILED },
      });

      console.error(
        `[send-queue] Job ${job.id} is DEAD after ${newAttempts} attempts: ${errorMessage}`,
      );
    } else {
      // Exponential backoff: 30s, 120s, 480s
      const backoffMs = 30_000 * Math.pow(4, job.attempts);
      const retryAfter = new Date(Date.now() + backoffMs);

      await prisma.jobQueue.update({
        where: { id: job.id },
        data: {
          status: "PENDING",
          attempts: newAttempts,
          lastError: errorMessage,
          runAfter: retryAfter,
          startedAt: null,
        },
      });

      console.warn(
        `[send-queue] Job ${job.id} failed (attempt ${newAttempts}/${job.maxAttempts}), retrying at ${retryAfter.toISOString()}: ${errorMessage}`,
      );
    }
  }
}

// ─── Domain selection ───────────────────────────────────────────────

/**
 * Picks the healthiest READY sending domain with remaining daily capacity.
 * Returns the domain ID, or null if no domains are available.
 */
export async function pickSendingDomain(
  workspaceId: string,
): Promise<string | null> {
  const domains = await prisma.sendingDomain.findMany({
    where: {
      workspaceId,
      warmupStatus: "READY",
    },
    orderBy: { healthScore: "desc" },
    select: { id: true, dailySendLimit: true },
  });

  for (const domain of domains) {
    const todaySent = await getDailyDomainSendCount(domain.id);
    if (todaySent < domain.dailySendLimit) {
      return domain.id;
    }
  }

  return null;
}

/**
 * Counts the number of outreaches sent today for a specific domain.
 */
export async function getDailyDomainSendCount(
  domainId: string,
): Promise<number> {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const endOfDay = new Date();
  endOfDay.setHours(23, 59, 59, 999);

  return prisma.outreach.count({
    where: {
      sendingDomainId: domainId,
      status: OutreachStatus.SENT,
      sentAt: {
        gte: startOfDay,
        lte: endOfDay,
      },
    },
  });
}
