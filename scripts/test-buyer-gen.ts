import { prisma } from "../src/lib/db";
import { generateBuyerEmail } from "../src/lib/claude";

async function main() {
  const ws = await prisma.workspace.findFirstOrThrow({ where: { slug: "alta" }, select: { settings: true } });
  const buyerSystemPrompt = (ws.settings as Record<string, unknown>).buyerSystemPrompt as string;

  // pick a sponsor that has a platform + add-on if possible
  const deal = await prisma.deal.findFirst({ where: { sponsor: { not: null } }, orderBy: { announcedDate: "desc" } });
  const sponsor = deal!.sponsor!;
  const deals = await prisma.deal.findMany({ where: { sponsor }, orderBy: { announcedDate: "desc" }, take: 5 });
  console.log(`Sponsor: ${sponsor}  (${deals.length} deals)`);
  for (const d of deals) console.log(`  - [${d.dealType}] ${d.buyer} / ${d.target} (${d.industryLabel})`);

  const email = await generateBuyerEmail({
    buyerSystemPrompt, sponsor,
    deals: deals.map(d => ({ dealType: d.dealType, buyer: d.buyer, target: d.target, platform: d.platform, industry: d.industryLabel, summary: d.summary })),
  });
  console.log("\n=========== BUYER DRAFT ===========");
  console.log("SUBJECT:", email.subject);
  console.log("HOOK:", email.hookUsed, "| SCORE:", email.personalizationScore);
  console.log("-----------------------------------");
  console.log(email.bodyPlain);
  console.log("===================================");
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
