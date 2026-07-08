import { prisma } from "../src/lib/db";
import { generateBuyerEmail, type BuyerDealContext } from "../src/lib/claude";
import { OutreachStatus, PersonScore } from "../src/generated/prisma/client";

const personScoreMap: Record<string, PersonScore> = { low: PersonScore.LOW, medium: PersonScore.MEDIUM, high: PersonScore.HIGH };

async function main() {
  const ws = await prisma.workspace.findFirstOrThrow({ where: { slug: "alta" } });
  const user = await prisma.user.findFirstOrThrow({ where: { email: "montana@sourcealta.com" } });
  const buyerSystemPrompt = (ws.settings as Record<string, unknown>).buyerSystemPrompt as string;

  const seed = await prisma.deal.findFirst({ where: { sponsor: { not: null }, dealType: "platform" }, orderBy: { announcedDate: "desc" } });
  const sponsor = seed!.sponsor!;
  const deals = await prisma.deal.findMany({ where: { sponsor }, orderBy: { announcedDate: "desc" }, take: 5 });

  let campaign = await prisma.campaign.findFirst({ where: { workspaceId: ws.id, kind: "buyer" } });
  if (!campaign) campaign = await prisma.campaign.create({ data: { workspaceId: ws.id, name: "Buyer Outreach", type: "buyer_sourcing", kind: "buyer", status: "ACTIVE", createdById: user.id } });

  const contact = await prisma.contact.create({ data: { workspaceId: ws.id, campaignId: campaign.id, assignedToId: user.id, kind: "buyer", name: sponsor, email: "", organization: sponsor, status: "NEW" } });

  const dealContext: BuyerDealContext[] = deals.map(d => ({ dealType: d.dealType, buyer: d.buyer, target: d.target, platform: d.platform, industry: d.industryLabel, summary: d.summary }));
  const email = await generateBuyerEmail({ buyerSystemPrompt, sponsor, deals: dealContext });

  const outreach = await prisma.outreach.create({ data: { contactId: contact.id, campaignId: campaign.id, userId: user.id, type: "INITIAL", subject: email.subject, subjectVariants: email.subjectVariants, bodyHtml: email.bodyHtml, bodyPlain: email.bodyPlain, hookUsed: email.hookUsed, tone: email.tone, personalizationScore: personScoreMap[email.personalizationScore], status: OutreachStatus.DRAFT_CREATED, aiMetadata: { buyerOutreach: true, sponsor } } });

  console.log("E2E OK. sponsor:", sponsor, "| outreachId:", outreach.id, "| contact.kind:", contact.kind, "| contact.email:", JSON.stringify(contact.email));
  console.log("SUBJECT:", email.subject);
  const buyerDrafts = await prisma.outreach.count({ where: { campaign: { kind: "buyer" }, status: "DRAFT_CREATED" } });
  console.log("Buyer drafts now in review queue:", buyerDrafts);
}
main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
