import cron, { type ScheduledTask } from "node-cron";
import { processEmailQueue } from "./send-queue";
import { prisma } from "./db";
import { OutreachStatus, ContactStatus } from "@/generated/prisma/client";
import { getRecentReplies, getRecentBounces } from "./outlook";
import { classifyReplySentiment, generateEmail } from "./claude";

// ─── Active cron tasks (for graceful shutdown) ──────────────────────

const activeTasks: ScheduledTask[] = [];

// ─── Job: Process Email Send Queue ──────────────────────────────────

async function jobProcessSendQueue(): Promise<void> {
  console.log("[job-processor] Processing email send queue...");

  try {
    // Process up to 5 emails per cycle to avoid long-running jobs
    for (let i = 0; i < 5; i++) {
      await processEmailQueue();
    }
  } catch (error) {
    console.error(
      "[job-processor] Error processing send queue:",
      error instanceof Error ? error.message : error,
    );
  }
}

// ─── Bounce Detection ───────────────────────────────────────────────

const BOUNCE_SENDERS = [
  "postmaster@",
  "mailer-daemon@",
  "ndr@",
  "notify@microsoft.com",
  "postmaster@outlook.com",
  "postmaster@hotmail.com",
];

const BOUNCE_KEYWORDS = [
  "undeliverable",
  "delivery has failed",
  "couldn't be delivered",
  "could not be delivered",
  "delivery failure",
  "550 ",
  "user unknown",
  "mailbox not found",
  "does not exist",
  "no such user",
  "recipient rejected",
  "address rejected",
  "mailbox unavailable",
  "invalid recipient",
  "non-existent",
];

function isBounceMessage(from: string, body: string): boolean {
  const fromLower = from.toLowerCase();
  const bodyLower = body.toLowerCase();

  const isBounceSender = BOUNCE_SENDERS.some((s) => fromLower.includes(s));
  if (!isBounceSender) return false;

  return BOUNCE_KEYWORDS.some((kw) => bodyLower.includes(kw));
}

/**
 * Marks a contact as BOUNCED and cancels all non-sent outreach.
 */
async function markContactBounced(contactId: string): Promise<void> {
  await prisma.contact.update({
    where: { id: contactId },
    data: { status: ContactStatus.BOUNCED },
  });

  await prisma.outreach.updateMany({
    where: {
      contactId,
      status: { in: [OutreachStatus.SCHEDULED, OutreachStatus.DRAFT_CREATED, OutreachStatus.APPROVED] },
    },
    data: { status: OutreachStatus.CANCELLED },
  });
}

// ─── Job: Check for Replies ─────────────────────────────────────────

async function jobCheckReplies(): Promise<void> {
  console.log("[job-processor] Checking for replies...");

  try {
    // Find contacts with active outreach that have a conversation ID for tracking
    const contacts = await prisma.contact.findMany({
      where: {
        status: ContactStatus.OUTREACH_STARTED,
        outlookConversationId: { not: null },
      },
      include: {
        outreaches: {
          where: { status: OutreachStatus.SENT },
          orderBy: { sentAt: "desc" },
          take: 1,
          select: {
            id: true,
            userId: true,
            bodyPlain: true,
            subject: true,
          },
        },
      },
    });

    for (const contact of contacts) {
      if (!contact.outlookConversationId || contact.outreaches.length === 0) {
        continue;
      }

      const latestOutreach = contact.outreaches[0];

      try {
        const replies = await getRecentReplies(
          latestOutreach.userId,
          contact.outlookConversationId,
        );

        if (replies.length === 0) continue;

        // Take the most recent reply
        const latestReply = replies[0];

        // Check for bounce/NDR before anything else
        if (isBounceMessage(latestReply.from, latestReply.body)) {
          await markContactBounced(contact.id);
          console.log(
            `[job-processor] Bounce detected for ${contact.name} (${contact.email}) — marked as BOUNCED`,
          );
          continue;
        }

        // Skip if we already processed a reply for this contact
        if (contact.repliedAt) continue;

        // Classify the reply sentiment
        const classification = await classifyReplySentiment(
          latestReply.body,
          latestOutreach.bodyPlain ?? "",
        );

        // Update the outreach record with reply data
        await prisma.outreach.update({
          where: { id: latestOutreach.id },
          data: {
            replyContent: latestReply.body,
            replySentiment: classification.sentiment,
            suggestedReply: classification.suggestedReply,
          },
        });

        // Update contact status based on sentiment
        let newStatus: ContactStatus;
        switch (classification.sentiment) {
          case "interested":
            newStatus = ContactStatus.REPLIED;
            break;
          case "maybe_later":
            newStatus = ContactStatus.REPLIED;
            break;
          case "not_interested":
            newStatus = ContactStatus.NOT_INTERESTED;
            break;
          case "out_of_office":
            // Don't change status for OOO — they'll reply later
            newStatus = contact.status as ContactStatus;
            break;
          case "wrong_person":
            newStatus = ContactStatus.NOT_INTERESTED;
            break;
          default:
            newStatus = ContactStatus.REPLIED;
        }

        await prisma.contact.update({
          where: { id: contact.id },
          data: {
            status: newStatus,
            repliedAt: latestReply.receivedAt,
          },
        });

        // Cancel any pending follow-ups for contacts who replied
        if (
          classification.sentiment !== "out_of_office"
        ) {
          await prisma.outreach.updateMany({
            where: {
              contactId: contact.id,
              status: OutreachStatus.SCHEDULED,
            },
            data: {
              status: OutreachStatus.CANCELLED,
            },
          });
        }

        console.log(
          `[job-processor] Reply detected for ${contact.name} (${contact.email}): ${classification.sentiment}`,
        );
      } catch (error) {
        console.error(
          `[job-processor] Error checking replies for contact ${contact.id}:`,
          error instanceof Error ? error.message : error,
        );
        // Continue to next contact — don't let one failure stop the loop
      }
    }
  } catch (error) {
    console.error(
      "[job-processor] Error in reply check job:",
      error instanceof Error ? error.message : error,
    );
  }

  // ── Inbox bounce scan (catches NDRs outside conversation threads) ──
  try {
    // Get all users who have sent outreach (need their inbox access)
    const usersWithOutreach = await prisma.outreach.findMany({
      where: { status: OutreachStatus.SENT },
      select: { userId: true },
      distinct: ["userId"],
    });

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000); // last 24h

    for (const { userId } of usersWithOutreach) {
      try {
        const bouncedEmails = await getRecentBounces(userId, since);
        if (bouncedEmails.length === 0) continue;

        // Match bounced emails to contacts
        const bouncedContacts = await prisma.contact.findMany({
          where: {
            email: { in: bouncedEmails },
            status: { not: ContactStatus.BOUNCED },
          },
          select: { id: true, name: true, email: true },
        });

        for (const contact of bouncedContacts) {
          await markContactBounced(contact.id);
          console.log(
            `[job-processor] Inbox NDR: ${contact.name} (${contact.email}) — marked as BOUNCED`,
          );
        }
      } catch (error) {
        console.error(
          `[job-processor] Error scanning bounces for user ${userId}:`,
          error instanceof Error ? error.message : error,
        );
      }
    }
  } catch (error) {
    console.error(
      "[job-processor] Error in inbox bounce scan:",
      error instanceof Error ? error.message : error,
    );
  }
}

// ─── Job: Process Due Follow-ups ────────────────────────────────────

async function jobProcessFollowUps(): Promise<void> {
  console.log("[job-processor] Processing due follow-ups...");

  try {
    const now = new Date();

    // Find scheduled outreaches that are due
    const dueOutreaches = await prisma.outreach.findMany({
      where: {
        status: OutreachStatus.SCHEDULED,
        scheduledAt: { lte: now },
        type: { in: ["FOLLOWUP_1", "FOLLOWUP_2", "MEETING_REQUEST"] },
      },
      include: {
        contact: true,
        campaign: { include: { workspace: true } },
        user: true,
        parentOutreach: {
          select: {
            subject: true,
            bodyPlain: true,
            sentAt: true,
            type: true,
          },
        },
      },
      take: 10, // Process in batches
    });

    for (const outreach of dueOutreaches) {
      try {
        // Skip if the contact has already replied or is not interested
        if (
          outreach.contact.status === "REPLIED" ||
          outreach.contact.status === "NOT_INTERESTED" ||
          outreach.contact.status === "MEETING_SCHEDULED" ||
          outreach.contact.status === "CONVERTED"
        ) {
          await prisma.outreach.update({
            where: { id: outreach.id },
            data: { status: OutreachStatus.CANCELLED },
          });
          console.log(
            `[job-processor] Cancelled follow-up ${outreach.id} — contact status is ${outreach.contact.status}`,
          );
          continue;
        }

        // Build the previous emails list for context
        const previousEmails: Array<{
          type: string;
          subject: string;
          bodyPlain: string;
          sentAt: string;
        }> = [];

        if (outreach.parentOutreach) {
          previousEmails.push({
            type: outreach.parentOutreach.type,
            subject: outreach.parentOutreach.subject ?? "",
            bodyPlain: outreach.parentOutreach.bodyPlain ?? "",
            sentAt: outreach.parentOutreach.sentAt?.toISOString() ?? "",
          });
        }

        // Also look for any other sent outreaches in this thread
        const priorOutreaches = await prisma.outreach.findMany({
          where: {
            contactId: outreach.contactId,
            campaignId: outreach.campaignId,
            status: OutreachStatus.SENT,
            id: { not: outreach.id },
          },
          orderBy: { sentAt: "asc" },
          select: {
            type: true,
            subject: true,
            bodyPlain: true,
            sentAt: true,
          },
        });

        for (const prior of priorOutreaches) {
          if (
            !previousEmails.some(
              (p) => p.type === prior.type && p.subject === (prior.subject ?? ""),
            )
          ) {
            previousEmails.push({
              type: prior.type,
              subject: prior.subject ?? "",
              bodyPlain: prior.bodyPlain ?? "",
              sentAt: prior.sentAt?.toISOString() ?? "",
            });
          }
        }

        // Map outreach type to email type
        const emailTypeMap: Record<string, "initial" | "followup_1" | "followup_2" | "meeting_request"> = {
          FOLLOWUP_1: "followup_1",
          FOLLOWUP_2: "followup_2",
          MEETING_REQUEST: "meeting_request",
        };

        const emailType = emailTypeMap[outreach.type] ?? "followup_1";

        // Generate the follow-up email via Claude
        const generated = await generateEmail({
          workspaceSystemPrompt:
            outreach.campaign?.workspace?.aiSystemPrompt ?? "",
          contact: {
            name: outreach.contact.name,
            email: outreach.contact.email,
            title: outreach.contact.title ?? undefined,
            organization: outreach.contact.organization ?? undefined,
            orgType: outreach.contact.orgType ?? undefined,
            location: outreach.contact.location ?? undefined,
            notes: outreach.contact.notes ?? undefined,
            researchData:
              (outreach.contact.researchData as Record<string, unknown>) ??
              undefined,
          },
          campaignType: outreach.campaign?.type ?? "",
          emailType,
          previousEmails,
        });

        // Update the outreach record with generated content and set as DRAFT_CREATED
        await prisma.outreach.update({
          where: { id: outreach.id },
          data: {
            subject: generated.subject,
            subjectVariants: generated.subjectVariants,
            bodyHtml: generated.bodyHtml,
            bodyPlain: generated.bodyPlain,
            hookUsed: generated.hookUsed,
            tone: generated.tone,
            personalizationScore:
              generated.personalizationScore.toUpperCase() as
                | "LOW"
                | "MEDIUM"
                | "HIGH",
            status: OutreachStatus.DRAFT_CREATED,
          },
        });

        console.log(
          `[job-processor] Generated follow-up ${outreach.type} for ${outreach.contact.name} (${outreach.id})`,
        );
      } catch (error) {
        console.error(
          `[job-processor] Error generating follow-up ${outreach.id}:`,
          error instanceof Error ? error.message : error,
        );
        // Continue to next outreach
      }
    }
  } catch (error) {
    console.error(
      "[job-processor] Error in follow-up processing job:",
      error instanceof Error ? error.message : error,
    );
  }
}

// ─── Job: Warmup Agent (stub) ───────────────────────────────────────

async function jobRunWarmupAgent(): Promise<void> {
  console.log("[job-processor] Running warmup agent...");

  try {
    // TODO: Implement warmup logic
    // This will:
    // 1. Find domains with warmupStatus = WARMING
    // 2. Send warmup emails according to the ramp schedule
    // 3. Check for bounces and adjust health scores
    // 4. Graduate domains from WARMING to READY when ready

    const warmingDomains = await prisma.sendingDomain.findMany({
      where: { warmupStatus: "WARMING" },
    });

    console.log(
      `[job-processor] Warmup agent found ${warmingDomains.length} domains in WARMING status (stub — no action taken)`,
    );
  } catch (error) {
    console.error(
      "[job-processor] Error in warmup agent:",
      error instanceof Error ? error.message : error,
    );
  }
}

// ─── Main Scheduler ─────────────────────────────────────────────────

/**
 * Starts all background cron jobs. Call once at application startup.
 * Returns nothing — jobs run on their own schedules.
 */
export function startJobProcessor(): void {
  console.log("[job-processor] Starting background job scheduler...");

  // 1. Process email send queue: every 30 seconds
  const sendQueueTask = cron.schedule("*/30 * * * * *", () => {
    jobProcessSendQueue().catch((err) =>
      console.error("[job-processor] Unhandled error in send queue job:", err),
    );
  });
  activeTasks.push(sendQueueTask);
  console.log("[job-processor] Scheduled: send queue (every 30s)");

  // 2. Check for replies: every 15 minutes
  const replyCheckTask = cron.schedule("*/15 * * * *", () => {
    jobCheckReplies().catch((err) =>
      console.error(
        "[job-processor] Unhandled error in reply check job:",
        err,
      ),
    );
  });
  activeTasks.push(replyCheckTask);
  console.log("[job-processor] Scheduled: reply check (every 15 min)");

  // 3. Process due follow-ups: every hour at :05
  const followUpTask = cron.schedule("5 * * * *", () => {
    jobProcessFollowUps().catch((err) =>
      console.error("[job-processor] Unhandled error in follow-up job:", err),
    );
  });
  activeTasks.push(followUpTask);
  console.log("[job-processor] Scheduled: follow-up processing (hourly at :05)");

  // 4. Run warmup agent: daily at 9:00 AM
  const warmupTask = cron.schedule("0 9 * * *", () => {
    jobRunWarmupAgent().catch((err) =>
      console.error("[job-processor] Unhandled error in warmup agent:", err),
    );
  });
  activeTasks.push(warmupTask);
  console.log("[job-processor] Scheduled: warmup agent (daily at 9:00 AM)");

  console.log(
    `[job-processor] All ${activeTasks.length} background jobs started.`,
  );
}

/**
 * Stops all active cron jobs for graceful shutdown.
 */
export function stopJobProcessor(): void {
  console.log(
    `[job-processor] Stopping ${activeTasks.length} background jobs...`,
  );

  for (const task of activeTasks) {
    task.stop();
  }

  activeTasks.length = 0;
  console.log("[job-processor] All background jobs stopped.");
}

// ─── Manual Trigger Functions (used by the cron API route) ──────────

export { jobProcessSendQueue, jobCheckReplies, jobProcessFollowUps, jobRunWarmupAgent };
