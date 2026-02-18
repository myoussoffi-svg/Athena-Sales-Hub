import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getActiveWorkspaceId } from "@/lib/workspace";
import { generateEmail } from "@/lib/claude";
import { generateVoiceProfile } from "@/lib/voice-matching";
import {
  SCHOOL_ORG_TEMPLATE_PLAIN,
  SCHOOL_ORG_TEMPLATE_HTML,
  SCHOOL_ORG_TEMPLATE_SUBJECT_PREFIX,
} from "@/lib/templates";
import { OutreachStatus, PersonScore } from "@/generated/prisma/client";

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const workspaceId = await getActiveWorkspaceId();
  if (!workspaceId) {
    return NextResponse.json(
      { error: "No workspace selected" },
      { status: 400 },
    );
  }

  const body = await request.json();
  const { campaignId, contactIds } = body as {
    campaignId: string;
    contactIds?: string[];
    useTemplate?: boolean;
  };

  if (!campaignId) {
    return NextResponse.json(
      { error: "campaignId is required" },
      { status: 400 },
    );
  }

  // Verify campaign exists in workspace
  const campaign = await prisma.campaign.findFirst({
    where: { id: campaignId, workspaceId },
  });
  if (!campaign) {
    return NextResponse.json(
      { error: "Campaign not found" },
      { status: 404 },
    );
  }

  // Load workspace with system prompt
  const workspace = await prisma.workspace.findUniqueOrThrow({
    where: { id: workspaceId },
  });

  // Load voice samples for the user and generate profile if available
  const voiceSamples = await prisma.voiceSample.findMany({
    where: { workspaceId, userId: session.user.id },
    select: { sampleText: true },
  });

  let voiceProfile: string | undefined;
  if (voiceSamples.length > 0) {
    try {
      voiceProfile = await generateVoiceProfile(
        voiceSamples.map((s: { sampleText: string }) => s.sampleText),
      );
    } catch (err) {
      console.warn("[outreach/generate] Voice profile generation failed:", err);
      // Continue without voice profile
    }
  }

  // Get contacts to generate for
  let contacts;
  if (contactIds && contactIds.length > 0) {
    contacts = await prisma.contact.findMany({
      where: {
        id: { in: contactIds },
        workspaceId,
        campaignId,
      },
    });
  } else {
    // Get all NEW or RESEARCHED contacts in the campaign that don't already have outreach
    contacts = await prisma.contact.findMany({
      where: {
        workspaceId,
        campaignId,
        status: { in: ["NEW", "RESEARCHED"] },
        outreaches: { none: {} },
      },
    });
  }

  if (contacts.length === 0) {
    return NextResponse.json(
      { error: "No eligible contacts found", count: 0 },
      { status: 400 },
    );
  }

  const personScoreMap: Record<string, PersonScore> = {
    low: PersonScore.LOW,
    medium: PersonScore.MEDIUM,
    high: PersonScore.HIGH,
  };

  const useTemplate = body.useTemplate === true;

  // Process sequentially to avoid Claude API rate limits
  let generated = 0;
  const errors: string[] = [];

  for (const contact of contacts) {
    try {
      // Check if there are previous outreaches for this contact (for follow-ups)
      const previousOutreaches = await prisma.outreach.findMany({
        where: { contactId: contact.id, status: OutreachStatus.SENT },
        orderBy: { sentAt: "asc" },
        select: {
          type: true,
          subject: true,
          bodyPlain: true,
          sentAt: true,
        },
      });

      const emailType =
        previousOutreaches.length === 0
          ? "initial"
          : previousOutreaches.length === 1
            ? "followup_1"
            : "followup_2";

      let subject: string;
      let subjectVariants: string[];
      let bodyHtml: string;
      let bodyPlain: string;
      let hookUsed: string;
      let tone: string;
      let personalizationScore: PersonScore;

      if (useTemplate) {
        // Use fixed standard template
        subject = `${SCHOOL_ORG_TEMPLATE_SUBJECT_PREFIX} - ${contact.organization || contact.name}`;
        subjectVariants = [subject];
        bodyHtml = SCHOOL_ORG_TEMPLATE_HTML;
        bodyPlain = SCHOOL_ORG_TEMPLATE_PLAIN;
        hookUsed = "Standard school org template";
        tone = "warm professional";
        personalizationScore = PersonScore.MEDIUM;
      } else {
        // AI-generated email for non-school-org campaigns (and follow-ups)
        const result = await generateEmail({
          workspaceSystemPrompt: workspace.aiSystemPrompt,
          voiceProfile,
          contact: {
            name: contact.name,
            email: contact.email,
            title: contact.title ?? undefined,
            organization: contact.organization ?? undefined,
            orgType: contact.orgType ?? undefined,
            location: contact.location ?? undefined,
            notes: contact.notes ?? undefined,
            researchData:
              (contact.researchData as Record<string, unknown>) ?? undefined,
          },
          campaignType: campaign.type,
          emailType,
          previousEmails: previousOutreaches.map(
            (o: {
              type: string;
              subject: string | null;
              bodyPlain: string | null;
              sentAt: Date | null;
            }) => ({
              type: o.type,
              subject: o.subject ?? "",
              bodyPlain: o.bodyPlain ?? "",
              sentAt: o.sentAt?.toISOString() ?? "",
            }),
          ),
        });

        subject = result.subject;
        subjectVariants = result.subjectVariants;
        bodyHtml = result.bodyHtml;
        bodyPlain = result.bodyPlain;
        hookUsed = result.hookUsed;
        tone = result.tone;
        personalizationScore = personScoreMap[result.personalizationScore];
      }

      // Create outreach record
      await prisma.outreach.create({
        data: {
          contactId: contact.id,
          campaignId: campaign.id,
          userId: session.user.id,
          type:
            emailType === "initial"
              ? "INITIAL"
              : emailType === "followup_1"
                ? "FOLLOWUP_1"
                : "FOLLOWUP_2",
          subject,
          subjectVariants,
          bodyHtml,
          bodyPlain,
          hookUsed,
          tone,
          personalizationScore,
          aiMetadata: {
            generatedAt: new Date().toISOString(),
            voiceProfileUsed: !useTemplate && !!voiceProfile,
            templateUsed: useTemplate ? "school_org_standard" : undefined,
          },
          status: OutreachStatus.DRAFT_CREATED,
        },
      });

      generated++;
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Unknown error";
      console.error(
        `[outreach/generate] Failed for contact ${contact.id}:`,
        message,
      );
      errors.push(`${contact.name}: ${message}`);
    }
  }

  return NextResponse.json({
    count: generated,
    total: contacts.length,
    errors: errors.length > 0 ? errors : undefined,
  });
}
