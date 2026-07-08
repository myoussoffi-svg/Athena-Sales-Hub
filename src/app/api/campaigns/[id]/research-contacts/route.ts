import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireWorkspaceApi } from "@/lib/workspace";
import { enrichContactWithResearch } from "@/lib/research-agent";

/**
 * Bulk-researches every un-researched contact in a campaign that has a website.
 * Runs enrichment with limited concurrency so we don't hammer target sites or
 * exhaust the serverless function. Idempotent: only touches NEW contacts with a
 * websiteUrl, so re-running skips already-researched ones.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const result = await requireWorkspaceApi();
  if ("error" in result) return result.error;
  const { workspaceId } = result;

  const { id: campaignId } = await params;

  // Verify campaign belongs to the workspace
  const campaign = await prisma.campaign.findFirst({
    where: { id: campaignId, workspaceId },
    select: { id: true },
  });
  if (!campaign) {
    return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
  }

  // Contacts still awaiting research (NEW) that actually have a site to scrape
  const contacts = await prisma.contact.findMany({
    where: {
      workspaceId,
      campaignId,
      status: "NEW",
      websiteUrl: { not: null },
    },
    select: { id: true },
  });

  // Contacts we can't research (no website) — surfaced so the UI can explain
  const skippedNoUrl = await prisma.contact.count({
    where: { workspaceId, campaignId, status: "NEW", websiteUrl: null },
  });

  let researched = 0;
  let failed = 0;
  const CONCURRENCY = 4;

  for (let i = 0; i < contacts.length; i += CONCURRENCY) {
    const batch = contacts.slice(i, i + CONCURRENCY);
    await Promise.all(
      batch.map((c) =>
        enrichContactWithResearch(c.id)
          .then(() => {
            researched++;
          })
          .catch((err) => {
            failed++;
            console.error(
              `[research-contacts] Failed for contact ${c.id}:`,
              err instanceof Error ? err.message : err,
            );
          }),
      ),
    );
  }

  return NextResponse.json({
    researched,
    failed,
    total: contacts.length,
    skippedNoUrl,
  });
}
