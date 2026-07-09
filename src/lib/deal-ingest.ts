import { prisma } from "./db";
import { fetchDeals, type BuyoutDeskDeal } from "./buyoutdesk";
import { extractPressReleaseContact } from "./press-contact";

/**
 * Fetches the latest deals from Buyout Desk and upserts them into the Deal
 * table (idempotent on externalId). Meant to run daily so the store accumulates
 * history — that history is what makes the high-velocity-sponsor ranking work,
 * since a single pull only returns the most recent ~40 deals.
 *
 * For genuinely new platform/add_on deals, also looks up the quoted contact
 * from the deal's real press release and caches it on the row — this runs
 * once per deal (not on every refresh), so it stays cheap as the feed grows.
 */
export async function ingestDeals(
  limit = 100,
): Promise<{ fetched: number; upserted: number; contactsFound: number }> {
  const deals = await fetchDeals({ limit });

  let upserted = 0;
  let contactsFound = 0;
  for (const d of deals) {
    const data = mapDeal(d);
    const existing = await prisma.deal.findUnique({
      where: { externalId: d.id },
      select: { id: true },
    });

    if (existing) {
      await prisma.deal.update({ where: { externalId: d.id }, data });
    } else {
      const created = await prisma.deal.create({ data });
      if (created.dealType === "platform" || created.dealType === "add_on") {
        try {
          const contact = await extractPressReleaseContact({
            sponsor: created.sponsor ?? "",
            target: created.target,
            platform: created.platform,
            dealType: created.dealType,
            announcedDate: created.announcedDate,
            headline: created.headline,
          });
          if (contact) {
            await prisma.deal.update({
              where: { id: created.id },
              data: {
                contactName: contact.name,
                contactTitle: contact.title,
                contactFirm: contact.firm,
                contactSourceType: contact.sourceType,
                contactSourceUrl: contact.sourceUrl,
              },
            });
            contactsFound++;
          }
        } catch (err) {
          console.error(`[deal-ingest] contact extraction failed for ${created.headline}:`, err);
        }
      }
    }
    upserted++;
  }

  return { fetched: deals.length, upserted, contactsFound };
}

function mapDeal(d: BuyoutDeskDeal) {
  return {
    externalId: d.id,
    announcedDate: new Date(d.announced_date),
    dealType: d.deal_type,
    headline: d.headline,
    dek: d.dek,
    summary: d.summary,
    body: d.body,
    takeaways: d.takeaways ?? undefined,
    buyer: d.buyer,
    target: d.target,
    sponsor: d.sponsor,
    seller: d.seller,
    platform: d.platform,
    industryLabel: d.industry?.label ?? null,
    industrySlug: d.industry?.slug ?? null,
    subsectors: d.subsectors ?? undefined,
    dealValue: d.deal_value,
    enterpriseValue: d.enterprise_value,
    acquirerDomain: d.logo?.domain ?? null,
    publicUrl: d.public_url,
  };
}
