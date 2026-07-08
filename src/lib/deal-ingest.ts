import { prisma } from "./db";
import { fetchDeals, type BuyoutDeskDeal } from "./buyoutdesk";

/**
 * Fetches the latest deals from Buyout Desk and upserts them into the Deal
 * table (idempotent on externalId). Meant to run daily so the store accumulates
 * history — that history is what makes the high-velocity-sponsor ranking work,
 * since a single pull only returns the most recent ~40 deals.
 */
export async function ingestDeals(
  limit = 100,
): Promise<{ fetched: number; upserted: number }> {
  const deals = await fetchDeals({ limit });

  let upserted = 0;
  for (const d of deals) {
    const data = mapDeal(d);
    await prisma.deal.upsert({
      where: { externalId: d.id },
      create: data,
      update: data,
    });
    upserted++;
  }

  return { fetched: deals.length, upserted };
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
