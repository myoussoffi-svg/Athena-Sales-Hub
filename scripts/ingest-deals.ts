import { ingestDeals } from "../src/lib/deal-ingest";
import { prisma } from "../src/lib/db";

async function main() {
  const result = await ingestDeals(100);
  console.log("Ingest result:", result);
  const total = await prisma.deal.count();
  console.log("Total deals in DB:", total);
  const byType = await prisma.deal.groupBy({ by: ["dealType"], _count: { _all: true } });
  console.log("By type:", byType.map((t) => `${t.dealType}=${t._count._all}`).join("  "));
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
