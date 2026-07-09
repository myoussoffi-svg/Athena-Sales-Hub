import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireWorkspaceApi } from "@/lib/workspace";
import { generateBuyerEmail, type BuyerDealContext } from "@/lib/claude";
import { extractPressReleaseContact, type PressReleaseContact } from "@/lib/press-contact";
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
  const dealId = (body.dealId as string | undefined)?.trim() || undefined;

  // A per-row draft (from the Recent Deals feed) names the exact deal to
  // hook on; a sponsor-level draft (from the leaderboard) uses their most
  // recent one instead.
  let namedDeal = null as Awaited<ReturnType<typeof prisma.deal.findUnique>> | null;
  if (dealId) {
    namedDeal = await prisma.deal.findUnique({ where: { id: dealId } });
    if (!namedDeal) {
      return NextResponse.json({ error: "Deal not found" }, { status: 404 });
    }
  }

  const sponsor = (namedDeal?.sponsor ?? (body.sponsor as string | undefined))?.trim();
  if (!sponsor) {
    return NextResponse.json({ error: "sponsor is required" }, { status: 400 });
  }

  // Recent deals for this sponsor — additional context for the email
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

  // The specific deal named by dealId, else the sponsor's most recent —
  // this is the deal the email's hook and contact are drawn from.
  const primaryDeal = namedDeal ?? deals[0];

  // Reuse the contact cached at ingestion time; only fall back to a live
  // press-release search (and cache the result for next time) if it's
  // missing — e.g. an older deal ingested before this cache existed.
  let pressContact: PressReleaseContact | null = primaryDeal.contactName
    ? {
        name: primaryDeal.contactName,
        title: primaryDeal.contactTitle ?? "",
        firm: primaryDeal.contactFirm ?? sponsor,
        sourceType:
          (primaryDeal.contactSourceType as PressReleaseContact["sourceType"]) ??
          "sponsor_investment_professional",
        sourceUrl: primaryDeal.contactSourceUrl ?? undefined,
      }
    : null;

  if (!pressContact) {
    pressContact = await extractPressReleaseContact({
      sponsor,
      target: primaryDeal.target,
      platform: primaryDeal.platform,
      dealType: primaryDeal.dealType,
      announcedDate: primaryDeal.announcedDate,
      headline: primaryDeal.headline,
    });
    if (pressContact) {
      await prisma.deal.update({
        where: { id: primaryDeal.id },
        data: {
          contactName: pressContact.name,
          contactTitle: pressContact.title,
          contactFirm: pressContact.firm,
          contactSourceType: pressContact.sourceType,
          contactSourceUrl: pressContact.sourceUrl,
        },
      });
    }
  }

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

  // The clicked/named deal leads the list so the email hooks on it
  // specifically, even if it isn't the sponsor's single most recent deal.
  const orderedDeals = [
    primaryDeal,
    ...deals.filter((d) => d.id !== primaryDeal.id),
  ].slice(0, 5);

  const dealContext: BuyerDealContext[] = orderedDeals.map((d) => ({
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
