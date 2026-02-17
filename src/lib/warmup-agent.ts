import { prisma } from "./db";
import { sendViaSMTP } from "./smtp";
import { decrypt } from "./encryption";
import { resolveTxt } from "node:dns/promises";

// ─── Warmup Email Templates ────────────────────────────────────

interface WarmupTemplate {
  subject: string;
  body: string;
}

const FIRST_NAMES = [
  "Alex", "Jordan", "Taylor", "Morgan", "Casey",
  "Riley", "Drew", "Cameron", "Jamie", "Avery",
];

const LAST_NAMES = [
  "Mitchell", "Parker", "Reynolds", "Foster", "Coleman",
  "Brooks", "Hayes", "Sanders", "Bennett", "Crawford",
];

const PROJECT_NAMES = [
  "Atlas", "Meridian", "Pinnacle", "Horizon", "Summit",
  "Vanguard", "Catalyst", "Nexus", "Keystone", "Beacon",
];

const COMPANY_TYPES = [
  "consulting group", "advisory firm", "solutions team",
  "analytics division", "strategy group",
];

function randomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function generateWarmupEmail(): WarmupTemplate {
  const templates = [
    generateBusinessInquiry,
    generateScheduling,
    generateProjectUpdate,
    generateFollowUp,
    generateIntroduction,
    generateThankYou,
    generateResourceSharing,
    generateMeetingRecap,
  ];

  return randomItem(templates)();
}

function generateBusinessInquiry(): WarmupTemplate {
  const name = `${randomItem(FIRST_NAMES)} ${randomItem(LAST_NAMES)}`;
  const project = randomItem(PROJECT_NAMES);
  const company = randomItem(COMPANY_TYPES);
  const topics = [
    "market expansion strategy",
    "Q2 operational review",
    "partnership opportunities",
    "supply chain optimization",
    "client acquisition framework",
  ];
  const topic = randomItem(topics);

  return {
    subject: `Quick question about ${topic}`,
    body: `Hi there,

I hope this message finds you well. My name is ${name} and I'm reaching out from our ${company}.

We've been reviewing the ${project} initiative and I had a few questions about ${topic} that I was hoping to discuss. Our team has been making good progress, but I think there may be an opportunity to align efforts.

Would you have 15 minutes this week for a brief call? I'm flexible on timing and can work around your schedule.

Looking forward to hearing from you.

Best regards,
${name}`,
  };
}

function generateScheduling(): WarmupTemplate {
  const name = `${randomItem(FIRST_NAMES)} ${randomItem(LAST_NAMES)}`;
  const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
  const day1 = randomItem(days);
  const day2 = randomItem(days.filter((d) => d !== day1));
  const times = ["9:00 AM", "10:30 AM", "1:00 PM", "2:30 PM", "4:00 PM"];

  return {
    subject: `Scheduling: ${randomItem(PROJECT_NAMES)} sync`,
    body: `Hi,

I wanted to reach out and get something on the calendar for next week. We should touch base on the latest updates before the end of the month.

Here are a few times that work on my end:
- ${day1} at ${randomItem(times)}
- ${day2} at ${randomItem(times)}
- ${randomItem(days)} at ${randomItem(times)}

Let me know what works best for you, or feel free to suggest an alternative time.

Thanks,
${name}`,
  };
}

function generateProjectUpdate(): WarmupTemplate {
  const name = `${randomItem(FIRST_NAMES)} ${randomItem(LAST_NAMES)}`;
  const project = randomItem(PROJECT_NAMES);
  const milestones = [
    "completed the initial assessment phase",
    "finalized the vendor selection",
    "wrapped up stakeholder interviews",
    "delivered the preliminary findings",
    "finished the competitive analysis",
  ];

  return {
    subject: `Update: ${project} project progress`,
    body: `Hi team,

Quick update on the ${project} project — we've ${randomItem(milestones)} and are moving into the next stage.

Key highlights:
- Timeline remains on track for the ${randomItem(["Q1", "Q2", "Q3", "Q4"])} deadline
- Budget utilization is at ${randomInt(60, 85)}% of allocated resources
- No blockers at this time

I'll send a more detailed report by end of week. Let me know if you have any questions or concerns in the meantime.

Regards,
${name}`,
  };
}

function generateFollowUp(): WarmupTemplate {
  const name = `${randomItem(FIRST_NAMES)} ${randomItem(LAST_NAMES)}`;
  const contexts = [
    "our conversation last week",
    "the proposal I sent over",
    "the meeting we had on Thursday",
    "your earlier email about the timeline",
    "the documents I shared",
  ];

  return {
    subject: `Following up on ${randomItem(["our discussion", "last week", "the proposal", "next steps"])}`,
    body: `Hi,

Just wanted to follow up on ${randomItem(contexts)}. I know things get busy, so no rush at all — just wanted to make sure this didn't fall through the cracks.

If you've had a chance to review, I'd love to hear your thoughts. Otherwise, happy to reconnect when you have a moment.

Thanks for your time,
${name}`,
  };
}

function generateIntroduction(): WarmupTemplate {
  const name = `${randomItem(FIRST_NAMES)} ${randomItem(LAST_NAMES)}`;
  const role = randomItem([
    "business development associate",
    "project coordinator",
    "account manager",
    "operations lead",
    "strategy consultant",
  ]);
  const company = randomItem(COMPANY_TYPES);

  return {
    subject: `Introduction — ${name}`,
    body: `Hello,

I wanted to take a moment to introduce myself. I'm ${name}, a ${role} with our ${company}. I recently joined the team and have been getting up to speed on current initiatives.

I understand you've been involved with some of the key projects in this space, and I'd love to connect when you have a moment. Always great to build relationships with the people driving results.

Feel free to reach out anytime — looking forward to connecting.

Warm regards,
${name}`,
  };
}

function generateThankYou(): WarmupTemplate {
  const name = `${randomItem(FIRST_NAMES)} ${randomItem(LAST_NAMES)}`;
  const reasons = [
    "taking the time to meet yesterday",
    "sharing those insights during our call",
    "the quick turnaround on the review",
    "your feedback on the draft",
    "helping coordinate with the other teams",
  ];

  return {
    subject: `Thank you`,
    body: `Hi,

Just a quick note to say thank you for ${randomItem(reasons)}. It was really helpful and I appreciate you making the time.

I've noted the action items on my end and will follow up once I have updates. Please don't hesitate to reach out if anything else comes up.

Best,
${name}`,
  };
}

function generateResourceSharing(): WarmupTemplate {
  const name = `${randomItem(FIRST_NAMES)} ${randomItem(LAST_NAMES)}`;
  const resources = [
    "the market analysis report",
    "the updated project timeline",
    "the revised budget spreadsheet",
    "the client feedback summary",
    "the competitive landscape overview",
  ];

  return {
    subject: `Sharing: ${randomItem(["report", "document", "update", "summary", "overview"])} for your review`,
    body: `Hi,

I wanted to share ${randomItem(resources)} that our team put together. I think you'll find it useful as we move into the next phase.

I've attached the latest version — take a look when you get a chance and let me know if anything jumps out or if you'd like to discuss further.

No immediate action needed, just wanted to keep you in the loop.

Cheers,
${name}`,
  };
}

function generateMeetingRecap(): WarmupTemplate {
  const name = `${randomItem(FIRST_NAMES)} ${randomItem(LAST_NAMES)}`;
  const project = randomItem(PROJECT_NAMES);

  return {
    subject: `Recap: ${project} meeting notes`,
    body: `Hi all,

Thanks for joining the ${project} meeting today. Here's a quick summary of what we covered:

1. Reviewed current progress — we're tracking well against our milestones
2. Discussed the upcoming deliverables for the next ${randomInt(2, 4)} weeks
3. Identified a few areas that need additional input from stakeholders

Action items:
- I'll circulate the updated timeline by ${randomItem(["Monday", "Wednesday", "Friday"])}
- Please review and share any feedback by end of week

Let me know if I missed anything or if you have questions.

Thanks,
${name}`,
  };
}

// ─── Warmup Phase Configuration ─────────────────────────────────

function getSendTarget(dayNumber: number): { min: number; max: number } {
  if (dayNumber <= 7) return { min: 2, max: 3 };
  if (dayNumber <= 14) return { min: 5, max: 8 };
  if (dayNumber <= 21) return { min: 10, max: 15 };
  if (dayNumber <= 28) return { min: 15, max: 20 };
  // Day 29+ — should already be marked READY, but handle gracefully
  return { min: 20, max: 20 };
}

function getDailySendLimit(dayNumber: number): number {
  if (dayNumber <= 7) return 3;
  if (dayNumber <= 14) return 8;
  if (dayNumber <= 21) return 15;
  return 20;
}

// ─── Core Functions ─────────────────────────────────────────────

/**
 * Main warmup cycle — runs daily for each domain in WARMING status.
 * Sends realistic emails between workspace domains to build sender reputation.
 */
export async function runWarmupCycle(): Promise<void> {
  const warmingDomains = await prisma.sendingDomain.findMany({
    where: { warmupStatus: "WARMING" },
    include: { workspace: true },
  });

  for (const domain of warmingDomains) {
    try {
      const currentDay = domain.warmupDayNumber + 1;

      // Day 29+: warmup complete
      if (currentDay > 28) {
        await prisma.sendingDomain.update({
          where: { id: domain.id },
          data: {
            warmupStatus: "READY",
            dailySendLimit: 20,
            warmupDayNumber: currentDay,
          },
        });
        console.log(`[warmup] Domain ${domain.domain} warmup complete — marked READY`);
        continue;
      }

      // Get other domains in the same workspace to use as recipients
      const recipientDomains = await prisma.sendingDomain.findMany({
        where: {
          workspaceId: domain.workspaceId,
          id: { not: domain.id },
        },
      });

      if (recipientDomains.length === 0) {
        console.log(
          `[warmup] No recipient domains for ${domain.domain} — skipping (add at least 2 domains per workspace)`,
        );
        continue;
      }

      // Calculate how many emails to send today
      const { min, max } = getSendTarget(currentDay);
      const sendCount = randomInt(min, max);

      // Decrypt SMTP credentials
      if (!domain.smtpHost || !domain.smtpUser || !domain.smtpPass) {
        console.log(`[warmup] Domain ${domain.domain} missing SMTP config — skipping`);
        continue;
      }

      const smtpPass = decrypt(domain.smtpPass);

      let sentCount = 0;
      let bounceCount = 0;

      for (let i = 0; i < sendCount; i++) {
        const recipient = randomItem(recipientDomains) as typeof recipientDomains[number];
        const template = generateWarmupEmail();

        try {
          await sendViaSMTP(
            {
              host: domain.smtpHost,
              port: domain.smtpPort ?? 587,
              user: domain.smtpUser,
              pass: smtpPass,
            },
            {
              from: domain.emailAddress,
              fromName: domain.displayName ?? undefined,
              to: recipient.emailAddress,
              subject: template.subject,
              html: template.body.replace(/\n/g, "<br>"),
            },
          );
          sentCount++;
        } catch (error) {
          console.error(
            `[warmup] Failed to send from ${domain.emailAddress} to ${recipient.emailAddress}:`,
            error,
          );
          bounceCount++;
        }

        // Small delay between sends (1-3 seconds) to appear natural
        await new Promise((resolve) =>
          setTimeout(resolve, randomInt(1000, 3000)),
        );
      }

      // Calculate health score
      const totalSent = domain.totalSent + sentCount;
      const totalBounced = domain.totalBounced + bounceCount;
      const bounceRate = totalSent > 0 ? totalBounced / totalSent : 0;
      const healthScore = Math.max(0, Math.round(100 - bounceRate * 1000));

      // Update domain stats
      await prisma.sendingDomain.update({
        where: { id: domain.id },
        data: {
          warmupDayNumber: currentDay,
          dailySendLimit: getDailySendLimit(currentDay),
          totalSent,
          totalBounced,
          healthScore,
        },
      });

      // Log today's warmup activity
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      await prisma.warmupLog.upsert({
        where: {
          sendingDomainId_date: {
            sendingDomainId: domain.id,
            date: today,
          },
        },
        update: {
          emailsSent: { increment: sentCount },
          bounces: { increment: bounceCount },
          healthScore,
        },
        create: {
          sendingDomainId: domain.id,
          date: today,
          emailsSent: sentCount,
          bounces: bounceCount,
          healthScore,
        },
      });

      console.log(
        `[warmup] ${domain.domain} day ${currentDay}: sent ${sentCount}, bounced ${bounceCount}, health ${healthScore}`,
      );
    } catch (error) {
      console.error(`[warmup] Error processing domain ${domain.domain}:`, error);
    }
  }
}

/**
 * Start warming up a domain. Sets status to WARMING and resets day counter.
 */
export async function startWarmup(domainId: string): Promise<void> {
  await prisma.sendingDomain.update({
    where: { id: domainId },
    data: {
      warmupStatus: "WARMING",
      warmupStartedAt: new Date(),
      warmupDayNumber: 0,
      dailySendLimit: 2,
    },
  });
}

/**
 * Pause a domain's warmup. Can be resumed later.
 */
export async function pauseWarmup(domainId: string): Promise<void> {
  await prisma.sendingDomain.update({
    where: { id: domainId },
    data: {
      warmupStatus: "PAUSED",
    },
  });
}

/**
 * Check DNS records for a domain: SPF, DKIM, and DMARC.
 */
export async function checkDomainDNS(
  domain: string,
): Promise<{ spf: boolean; dkim: boolean; dmarc: boolean }> {
  const result = { spf: false, dkim: false, dmarc: false };

  // SPF: TXT record on the domain containing "v=spf1"
  try {
    const txtRecords = await resolveTxt(domain);
    for (const record of txtRecords) {
      const joined = record.join("");
      if (joined.includes("v=spf1")) {
        result.spf = true;
        break;
      }
    }
  } catch {
    // DNS lookup failed — SPF not found
  }

  // DMARC: TXT record on _dmarc.{domain} containing "v=DMARC1"
  try {
    const dmarcRecords = await resolveTxt(`_dmarc.${domain}`);
    for (const record of dmarcRecords) {
      const joined = record.join("");
      if (joined.includes("v=DMARC1")) {
        result.dmarc = true;
        break;
      }
    }
  } catch {
    // DNS lookup failed — DMARC not found
  }

  // DKIM: TXT record on default._domainkey.{domain}
  // Note: This is a basic check using the "default" selector.
  // Actual DKIM selectors vary by provider.
  try {
    const dkimRecords = await resolveTxt(`default._domainkey.${domain}`);
    if (dkimRecords.length > 0) {
      result.dkim = true;
    }
  } catch {
    // DNS lookup failed — DKIM not found with default selector
  }

  return result;
}
