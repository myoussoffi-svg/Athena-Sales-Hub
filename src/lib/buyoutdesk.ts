/**
 * Buyout Desk read-only deals API client.
 * Source of the daily M&A deal feed that powers Buyer Outreach.
 */

const BASE_URL = "https://www.buyoutdesk.com/api/read-only/deals";

export interface BuyoutDeskDeal {
  id: string;
  announced_date: string;
  deal_type: string; // add_on | platform | exit | recap | minority_investment
  headline: string;
  dek: string | null;
  summary: string | null;
  body: string | null;
  takeaways: string[] | null;
  buyer: string | null;
  target: string | null;
  sponsor: string | null; // PE firm — the outreach target
  seller: string | null;
  platform: string | null;
  industry: { label: string; slug: string } | null;
  subsectors: { label: string; slug: string }[] | null;
  target_description: string | null;
  deal_value: string | null;
  enterprise_value: string | null;
  logo: { name?: string; domain?: string; logoUrl?: string } | null;
  public_url: string | null;
}

interface DealsResponse {
  generated_at: string;
  data: BuyoutDeskDeal[];
}

export interface FetchDealsOptions {
  limit?: number;
  offset?: number;
  type?: string; // platform | add_on | exit | recap | minority_investment
  sector?: string; // industry slug
}

export async function fetchDeals(
  opts: FetchDealsOptions = {},
): Promise<BuyoutDeskDeal[]> {
  const token = process.env.BUYOUTDESK_API_TOKEN;
  if (!token) {
    throw new Error("BUYOUTDESK_API_TOKEN is not set");
  }

  const params = new URLSearchParams();
  if (opts.limit) params.set("limit", String(opts.limit));
  if (opts.offset) params.set("offset", String(opts.offset));
  if (opts.type) params.set("type", opts.type);
  if (opts.sector) params.set("sector", opts.sector);

  const url = params.toString() ? `${BASE_URL}?${params}` : BASE_URL;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    throw new Error(
      `[buyoutdesk] API ${res.status}: ${(await res.text()).slice(0, 200)}`,
    );
  }

  const json = (await res.json()) as DealsResponse;
  return json.data ?? [];
}
