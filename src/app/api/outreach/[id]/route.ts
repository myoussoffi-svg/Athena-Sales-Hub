import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getActiveWorkspaceId } from "@/lib/workspace";
import { generateEmail } from "@/lib/claude";
import { generateVoiceProfile } from "@/lib/voice-matching";
import { enqueueEmail } from "@/lib/send-queue";
import { OutreachStatus, PersonScore } from "@/generated/prisma/client";

// ─── GET: Single outreach with full context ─────────────────────────

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
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

  const { id } = await params;

  const outreach = await prisma.outreach.findFirst({
    where: {
      id,
      user: {
        workspaces: { some: { workspaceId } },
      },
    },
    include: {
      contact: true,
      campaign: {
        select: { id: true, name: true, type: true },
      },
      parentOutreach: {
        select: { id: true, subject: true, bodyPlain: true, sentAt: true },
      },
    },
  });

  if (!outreach) {
    return NextResponse.json(
      { error: "Outreach not found" },
      { status: 404 },
    );
  }

  return NextResponse.json(outreach);
}

// ─── PATCH: Update outreach (approve, skip, regenerate, edit) ───────

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
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

  const { id } = await params;

  const outreach = await prisma.outreach.findFirst({
    where: {
      id,
      user: {
        workspaces: { some: { workspaceId } },
      },
    },
    include: {
      contact: true,
      campaign: true,
    },
  });

  if (!outreach) {
    return NextResponse.json(
      { error: "Outreach not found" },
      { status: 404 },
    );
  }

  const body = await request.json();

  // ── Action: Approve & Send ──────────────────────────────────────
  if (body.action === "approve") {
    if (outreach.status !== "DRAFT_CREATED") {
      return NextResponse.json(
        { error: "Only drafts can be approved" },
        { status: 400 },
      );
    }

    const updated = await prisma.outreach.update({
      where: { id },
      data: { status: OutreachStatus.APPROVED },
    });

    // Enqueue for sending
    await enqueueEmail(id);

    return NextResponse.json(updated);
  }

  // ── Action: Skip / Cancel ───────────────────────────────────────
  if (body.action === "skip") {
    const updated = await prisma.outreach.update({
      where: { id },
      data: { status: OutreachStatus.CANCELLED },
    });

    return NextResponse.json(updated);
  }

  // ── Action: Regenerate ──────────────────────────────────────────
  if (body.action === "regenerate") {
    const workspace = await prisma.workspace.findUniqueOrThrow({
      where: { id: workspaceId },
    });

    // Load voice samples
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
      } catch {
        // Continue without voice profile
      }
    }

    // Load previous sent emails for context
    const previousOutreaches = await prisma.outreach.findMany({
      where: {
        contactId: outreach.contactId,
        status: OutreachStatus.SENT,
      },
      orderBy: { sentAt: "asc" },
      select: { type: true, subject: true, bodyPlain: true, sentAt: true },
    });

    const emailType =
      outreach.type === "INITIAL"
        ? "initial"
        : outreach.type === "FOLLOWUP_1"
          ? "followup_1"
          : outreach.type === "FOLLOWUP_2"
            ? "followup_2"
            : "meeting_request";

    const result = await generateEmail({
      workspaceSystemPrompt: workspace.aiSystemPrompt,
      voiceProfile,
      contact: {
        name: outreach.contact.name,
        email: outreach.contact.email,
        title: outreach.contact.title ?? undefined,
        organization: outreach.contact.organization ?? undefined,
        orgType: outreach.contact.orgType ?? undefined,
        location: outreach.contact.location ?? undefined,
        notes: outreach.contact.notes ?? undefined,
        researchData:
          (outreach.contact.researchData as Record<string, unknown>) ??
          undefined,
      },
      campaignType: outreach.campaign?.type ?? "general",
      emailType: emailType as
        | "initial"
        | "followup_1"
        | "followup_2"
        | "meeting_request",
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
      customInstructions: body.customInstructions,
    });

    const personScoreMap: Record<string, PersonScore> = {
      low: PersonScore.LOW,
      medium: PersonScore.MEDIUM,
      high: PersonScore.HIGH,
    };

    const updated = await prisma.outreach.update({
      where: { id },
      data: {
        subject: result.subject,
        subjectVariants: result.subjectVariants,
        bodyHtml: result.bodyHtml,
        bodyPlain: result.bodyPlain,
        hookUsed: result.hookUsed,
        tone: result.tone,
        personalizationScore: personScoreMap[result.personalizationScore],
        aiMetadata: {
          generatedAt: new Date().toISOString(),
          voiceProfileUsed: !!voiceProfile,
          regeneratedWith: body.customInstructions || null,
        },
        status: OutreachStatus.DRAFT_CREATED,
      },
      include: {
        contact: true,
        campaign: { select: { id: true, name: true, type: true } },
      },
    });

    return NextResponse.json(updated);
  }

  // ── Manual edit: update subject / body ──────────────────────────
  let { subject, bodyHtml, bodyPlain } = body;

  if (subject === undefined && bodyHtml === undefined && bodyPlain === undefined) {
    return NextResponse.json(
      { error: "No valid fields to update" },
      { status: 400 },
    );
  }

  // If bodyHtml is plain text (no HTML tags), convert to proper HTML
  if (bodyHtml && !/<[a-z][\s\S]*>/i.test(bodyHtml)) {
    bodyHtml = bodyHtml
      .split(/\n{2,}/)
      .map((p: string) => `<p>${p.replace(/\n/g, "<br>")}</p>`)
      .join("");
  }

  const updated = await prisma.outreach.update({
    where: { id },
    data: {
      ...(subject !== undefined && { subject }),
      ...(bodyHtml !== undefined && { bodyHtml }),
      ...(bodyPlain !== undefined && { bodyPlain }),
    },
    include: {
      contact: true,
      campaign: { select: { id: true, name: true, type: true } },
    },
  });

  return NextResponse.json(updated);
}

// ─── DELETE: Remove an outreach ─────────────────────────────────────

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
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

  const { id } = await params;

  const outreach = await prisma.outreach.findFirst({
    where: {
      id,
      user: {
        workspaces: { some: { workspaceId } },
      },
    },
  });

  if (!outreach) {
    return NextResponse.json(
      { error: "Outreach not found" },
      { status: 404 },
    );
  }

  if (
    outreach.status !== "DRAFT_CREATED" &&
    outreach.status !== "SCHEDULED"
  ) {
    return NextResponse.json(
      { error: "Only drafts and scheduled outreaches can be deleted" },
      { status: 400 },
    );
  }

  await prisma.outreach.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}
