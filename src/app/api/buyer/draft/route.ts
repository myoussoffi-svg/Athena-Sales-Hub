import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireWorkspaceApi } from "@/lib/workspace";
import { generateBuyerEmail, type BuyerDealContext } from "@/lib/claude";
import { extractPressReleaseContact } from "@/lib/press-contact";
import { isRecruitingWorkspace } from "@/lib/branding";
import { OutreachStatus, PersonScore } from "@/generated/prisma/client";

export const maxDuration = 60;

const personScoreMap: Record<string, PersonScore> = {
  low: PersonScore.LOW,
  medium: PersonScore.MEDIUM,
  high: PersonScore.HIGH,
};

/**
 * Turns a PE sponsor into a review-ready buyer draft: gathers their recent
 * deals, writes a buyside-sourcing email hooked on that activity, and drops it
 * into the review queue as a buyer contact with an empty recipient (the user
 * fills the email from Apollo before sending).
 */
export async function POST(request: NextRequest) {
  const result = await requireWorkspaceApi();
  if ("error" in result) return result.error;
  const { user: sessionUser, workspaceId } = result;

  const workspace = await prisma.workspace.findUniqueOrThrow({
    where: { id: workspaceId },
  });
  if (isRecruitingWorkspace(workspace.slug)) {
    return NextResponse.json(
      { error: "Buyer outreach is not available in this workspace" },
      { status: 400 },
    );
  }

  const body = await request.json().catch(() => ({}));
  const sponsor = (body.sponsor as string | undefined)?.trim();
  if (!sponsor) {
    return NextResponse.json({ error: "sponsor is required" }, { status: 400 });
  }

  // Recent deals for this sponsor — the personalization hook
  const deals = await prisma.deal.findMany({
    where: { sponsor },
    orderBy: { announcedDate: "desc" },
    take: 5,
  });
  if (deals.length === 0) {
    return NextResponse.json(
      { error: `No deals on record for ${sponsor}` },
      { status: 400 },
    );
  }

  // Find the quoted contact from the deal's actual press release (Buyout
  // Desk's own summary has no quotes) — prefers a sponsor investment
  // professional, falls back to a portco executive, or null if none found.
  const primaryDeal = deals[0];
  const pressContact = await extractPressReleaseContact({
    sponsor,
    target: primaryDeal.target,
    platform: primaryDeal.platform,
    dealType: primaryDeal.dealType,
    announcedDate: primaryDeal.announcedDate,
    headline: primaryDeal.headline,
  });

  const buyerSystemPrompt = (
    (workspace.settings as Record<string, unknown>)?.buyerSystemPrompt as
      | string
      | undefined
  );
  if (!buyerSystemPrompt) {
    return NextResponse.json(
      { error: "Buyer system prompt not configured. Run sync-alta-prompt." },
      { status: 500 },
    );
  }

  // Reuse (or create) the single buyer campaign for this workspace
  let campaign = await prisma.campaign.findFirst({
    where: { workspaceId, kind: "buyer" },
  });
  if (!campaign) {
    campaign = await prisma.campaign.create({
      data: {
        workspaceId,
        name: "Buyer Outreach",
        type: "buyer_sourcing",
        kind: "buyer",
        status: "ACTIVE",
        createdById: sessionUser.id,
      },
    });
  }

  // Buyer contact — email left empty for the user to fill from Apollo.
  // Name/title come from the press-release quote when found; otherwise this
  // falls back to the sponsor firm name and a generic "Hi there," greeting.
  const primarySector = deals.find((d) => d.industryLabel)?.industryLabel ?? null;
  const contactNotes = [
    `PE sponsor. Recent deals: ${deals.map((d) => d.headline).slice(0, 3).join("; ")}`,
    pressContact
      ? `Quoted contact source: ${pressContact.sourceType === "sponsor_investment_professional" ? "sponsor investment professional" : "portco executive"} at ${pressContact.firm}${pressContact.sourceUrl ? ` (${pressContact.sourceUrl})` : ""}`
      : "No quoted contact found in a press release for this deal.",
  ].join("\n");

  const contact = await prisma.contact.create({
    data: {
      workspaceId,
      campaignId: campaign.id,
      assignedToId: sessionUser.id,
      kind: "buyer",
      name: pressContact?.name ?? sponsor,
      title: pressContact?.title,
      email: "",
      organization: sponsor,
      orgType: primarySector,
      notes: contactNotes,
      status: "NEW",
    },
  });

  const dealContext: BuyerDealContext[] = deals.map((d) => ({
    dealType: d.dealType,
    buyer: d.buyer,
    target: d.target,
    platform: d.platform,
    seller: d.seller,
    industry: d.industryLabel,
    summary: d.summary,
  }));

  const email = await generateBuyerEmail({
    buyerSystemPrompt,
    sponsor,
    deals: dealContext,
    contactName: pressContact?.name.split(" ")[0],
  });

  const outreach = await prisma.outreach.create({
    data: {
      contactId: contact.id,
      campaignId: campaign.id,
      userId: sessionUser.id,
      type: "INITIAL",
      subject: email.subject,
      subjectVariants: email.subjectVariants,
      bodyHtml: email.bodyHtml,
      bodyPlain: email.bodyPlain,
      hookUsed: email.hookUsed,
      tone: email.tone,
      personalizationScore: personScoreMap[email.personalizationScore],
      aiMetadata: {
        generatedAt: new Date().toISOString(),
        buyerOutreach: true,
        sponsor,
        pressContact: pressContact
          ? { name: pressContact.name, title: pressContact.title, firm: pressContact.firm, sourceType: pressContact.sourceType, sourceUrl: pressContact.sourceUrl }
          : null,
      },
      status: OutreachStatus.DRAFT_CREATED,
    },
  });

  return NextResponse.json({ outreachId: outreach.id, contactId: contact.id });
}
