import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireWorkspaceApi } from "@/lib/workspace";
import { enrichContactWithResearch } from "@/lib/research-agent";
import { generateEmail } from "@/lib/claude";
import { generateVoiceProfile } from "@/lib/voice-matching";
import {
  ContactStatus,
  OutreachStatus,
  PersonScore,
} from "@/generated/prisma/client";

// Cap the function well under Vercel limits; the client loops over chunks.
export const maxDuration = 60;

const CHUNK_MAX = 12;
const CHUNK_DEFAULT = 5;

/**
 * Prepares ONE small chunk of a campaign's contacts: research (if needed) then
 * draft. Designed to be called in a loop by the client so 100+ contacts never
 * exceed the serverless timeout. Stateless and resumable — it re-queries the
 * pending set each call, so a failed/timed-out chunk is simply retried.
 *
 * Pending = contacts in the campaign with status NEW/RESEARCHED and no outreach.
 * Returns { processed, drafted, remaining } so the caller can show progress and
 * know when to stop (remaining === 0).
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const result = await requireWorkspaceApi();
  if ("error" in result) return result.error;
  const { user: sessionUser, workspaceId } = result;
  const { id: campaignId } = await params;

  const body = await request.json().catch(() => ({}));
  const limit = Math.min(
    Math.max(Number(body.limit) || CHUNK_DEFAULT, 1),
    CHUNK_MAX,
  );

  const campaign = await prisma.campaign.findFirst({
    where: { id: campaignId, workspaceId },
  });
  if (!campaign) {
    return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
  }

  const pendingWhere = {
    workspaceId,
    campaignId,
    status: { in: [ContactStatus.NEW, ContactStatus.RESEARCHED] },
    outreaches: { none: {} },
  };

  const contacts = await prisma.contact.findMany({
    where: pendingWhere,
    take: limit,
    orderBy: { createdAt: "asc" },
  });

  if (contacts.length === 0) {
    return NextResponse.json({ processed: 0, drafted: 0, remaining: 0 });
  }

  // Workspace prompt + optional voice profile (built once per chunk)
  const workspace = await prisma.workspace.findUniqueOrThrow({
    where: { id: workspaceId },
  });
  const voiceSamples = await prisma.voiceSample.findMany({
    where: { workspaceId, userId: sessionUser.id },
    select: { sampleText: true },
  });
  let voiceProfile: string | undefined;
  if (voiceSamples.length > 0) {
    try {
      voiceProfile = await generateVoiceProfile(
        voiceSamples.map((s: { sampleText: string }) => s.sampleText),
      );
    } catch {
      // proceed without voice profile
    }
  }

  const personScoreMap: Record<string, PersonScore> = {
    low: PersonScore.LOW,
    medium: PersonScore.MEDIUM,
    high: PersonScore.HIGH,
  };

  let drafted = 0;
  for (const contact of contacts) {
    try {
      // Research the site if we haven't yet and there's one to scrape
      if (contact.status === "NEW" && contact.websiteUrl) {
        await enrichContactWithResearch(contact.id);
      }
      const fresh = await prisma.contact.findUniqueOrThrow({
        where: { id: contact.id },
      });

      const email = await generateEmail({
        workspaceSystemPrompt: workspace.aiSystemPrompt,
        voiceProfile,
        contact: {
          name: fresh.name,
          email: fresh.email,
          title: fresh.title ?? undefined,
          organization: fresh.organization ?? undefined,
          orgType: fresh.orgType ?? undefined,
          location: fresh.location ?? undefined,
          notes: fresh.notes ?? undefined,
          researchData:
            (fresh.researchData as Record<string, unknown>) ?? undefined,
        },
        campaignType: campaign.type,
        emailType: "initial",
      });

      await prisma.outreach.create({
        data: {
          contactId: fresh.id,
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
            voiceProfileUsed: !!voiceProfile,
          },
          status: OutreachStatus.DRAFT_CREATED,
        },
      });
      drafted++;
    } catch (err) {
      console.error(
        `[prepare-batch] Failed for contact ${contact.id}:`,
        err instanceof Error ? err.message : err,
      );
      // Leave the contact pending (no outreach) so a later chunk can retry it,
      // but skip it this pass to avoid blocking the batch.
    }
  }

  const remaining = await prisma.contact.count({ where: pendingWhere });

  return NextResponse.json({
    processed: contacts.length,
    drafted,
    remaining,
  });
}
