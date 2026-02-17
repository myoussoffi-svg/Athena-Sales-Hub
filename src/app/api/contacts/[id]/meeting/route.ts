import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getActiveWorkspaceId } from "@/lib/workspace";
import { getCalendarAvailability } from "@/lib/outlook";
import { generateEmail } from "@/lib/claude";
import { OutreachStatus, PersonScore } from "@/generated/prisma/client";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: contactId } = await params;

  const workspaceId = await getActiveWorkspaceId();
  if (!workspaceId) {
    return NextResponse.json(
      { error: "No workspace selected" },
      { status: 400 },
    );
  }

  // Verify contact belongs to workspace
  const contact = await prisma.contact.findFirst({
    where: { id: contactId, workspaceId },
  });

  if (!contact) {
    return NextResponse.json({ error: "Contact not found" }, { status: 404 });
  }

  // Get calendar availability for next 2 weeks
  const startDate = new Date();
  const endDate = new Date();
  endDate.setDate(endDate.getDate() + 14);

  try {
    const busySlots = await getCalendarAvailability(
      session.user.id,
      startDate,
      endDate,
    );

    return NextResponse.json({ busySlots });
  } catch (error) {
    console.error("[meeting] Failed to get calendar availability:", error);
    return NextResponse.json(
      {
        error: "Failed to get calendar availability. Please check your Microsoft connection.",
      },
      { status: 500 },
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: contactId } = await params;

  const workspaceId = await getActiveWorkspaceId();
  if (!workspaceId) {
    return NextResponse.json(
      { error: "No workspace selected" },
      { status: 400 },
    );
  }

  const body = await request.json();
  const { proposedTimes } = body as { proposedTimes: string[] };

  if (!proposedTimes || proposedTimes.length === 0) {
    return NextResponse.json(
      { error: "proposedTimes array is required" },
      { status: 400 },
    );
  }

  // Load contact and workspace
  const contact = await prisma.contact.findFirst({
    where: { id: contactId, workspaceId },
    include: {
      campaign: { select: { id: true, type: true } },
    },
  });

  if (!contact) {
    return NextResponse.json({ error: "Contact not found" }, { status: 404 });
  }

  const workspace = await prisma.workspace.findUniqueOrThrow({
    where: { id: workspaceId },
  });

  // Format proposed times for the email
  const formattedTimes = proposedTimes
    .map((t) =>
      new Date(t).toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
        timeZoneName: "short",
      }),
    )
    .join(", ");

  // Generate meeting request email using Claude
  const personScoreMap: Record<string, PersonScore> = {
    low: PersonScore.LOW,
    medium: PersonScore.MEDIUM,
    high: PersonScore.HIGH,
  };

  try {
    // Gather previous emails for context
    const previousOutreaches = await prisma.outreach.findMany({
      where: { contactId, status: OutreachStatus.SENT },
      orderBy: { sentAt: "asc" },
      select: {
        type: true,
        subject: true,
        bodyPlain: true,
        sentAt: true,
      },
    });

    const result = await generateEmail({
      workspaceSystemPrompt: workspace.aiSystemPrompt,
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
      campaignType: contact.campaign?.type ?? "general",
      emailType: "meeting_request",
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
      customInstructions: `Propose the following meeting times: ${formattedTimes}. Make it easy for them to pick one.`,
    });

    // Create outreach record with DRAFT_CREATED status
    const outreach = await prisma.outreach.create({
      data: {
        contactId: contact.id,
        campaignId: contact.campaignId,
        userId: session.user.id,
        type: "MEETING_REQUEST",
        subject: result.subject,
        subjectVariants: result.subjectVariants,
        bodyHtml: result.bodyHtml,
        bodyPlain: result.bodyPlain,
        hookUsed: result.hookUsed,
        tone: result.tone,
        personalizationScore: personScoreMap[result.personalizationScore],
        aiMetadata: {
          generatedAt: new Date().toISOString(),
          proposedTimes,
        },
        status: OutreachStatus.DRAFT_CREATED,
      },
    });

    return NextResponse.json({ outreach }, { status: 201 });
  } catch (error) {
    console.error("[meeting] Failed to generate meeting request:", error);
    return NextResponse.json(
      { error: "Failed to generate meeting request email" },
      { status: 500 },
    );
  }
}
