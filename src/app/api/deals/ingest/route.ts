import { NextResponse } from "next/server";
import { requireWorkspaceApi } from "@/lib/workspace";
import { ingestDeals } from "@/lib/deal-ingest";

// Fetch + upsert can take a few seconds; give it headroom.
export const maxDuration = 30;

/**
 * Pulls the latest deals from Buyout Desk and upserts them. Manual trigger for
 * now (a daily cron/external pinger can hit this same route later).
 */
export async function POST() {
  const result = await requireWorkspaceApi();
  if ("error" in result) return result.error;

  try {
    const { fetched, upserted } = await ingestDeals(100);
    return NextResponse.json({ fetched, upserted });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Ingest failed";
    console.error("[deals/ingest]", message);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
