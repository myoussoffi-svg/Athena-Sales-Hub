import { prisma } from "../src/lib/db";
import { extractPressReleaseContact } from "../src/lib/press-contact";

const CONCURRENCY = 4;

/**
 * One-off backfill: runs the press-release contact lookup for existing
 * platform/add_on deals that predate the contact-caching feature. New deals
 * get this automatically at ingestion time (see deal-ingest.ts) — this
 * script only needs to run once to fill in history.
 */
async function main() {
  const deals = await prisma.deal.findMany({
    where: { dealType: { in: ["platform", "add_on"] }, contactName: null },
    orderBy: { announcedDate: "desc" },
  });
  console.log(`Backfilling ${deals.length} deals (concurrency ${CONCURRENCY})...`);

  let found = 0;
  let done = 0;
  for (let i = 0; i < deals.length; i += CONCURRENCY) {
    const batch = deals.slice(i, i + CONCURRENCY);
    await Promise.all(
      batch.map(async (d) => {
        try {
          const contact = await extractPressReleaseContact({
            sponsor: d.sponsor ?? "",
            target: d.target,
            platform: d.platform,
            dealType: d.dealType,
            announcedDate: d.announcedDate,
            headline: d.headline,
          });
          if (contact) {
            await prisma.deal.update({
              where: { id: d.id },
              data: {
                contactName: contact.name,
                contactTitle: contact.title,
                contactFirm: contact.firm,
                contactSourceType: contact.sourceType,
                contactSourceUrl: contact.sourceUrl,
              },
            });
            found++;
          }
        } catch (err) {
          console.error(`  failed: ${d.headline}:`, err instanceof Error ? err.message : err);
        } finally {
          done++;
        }
      }),
    );
    console.log(`  ${done}/${deals.length} processed, ${found} contacts found so far`);
  }

  console.log(`Done. Found contacts for ${found}/${deals.length} deals.`);
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
