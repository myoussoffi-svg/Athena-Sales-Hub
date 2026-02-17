import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getActiveWorkspaceId } from "@/lib/workspace";
import { createCalendarEvent } from "@/lib/outlook";

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
  const { confirmedTime, duration = 30 } = body as {
    confirmedTime: string;
    duration?: number;
  };

  if (!confirmedTime) {
    return NextResponse.json(
      { error: "confirmedTime (ISO date string) is required" },
      { status: 400 },
    );
  }

  // Load contact and verify workspace
  const contact = await prisma.contact.findFirst({
    where: { id: contactId, workspaceId },
  });

  if (!contact) {
    return NextResponse.json({ error: "Contact not found" }, { status: 404 });
  }

  const startTime = new Date(confirmedTime);
  const endTime = new Date(startTime.getTime() + duration * 60 * 1000);

  try {
    // Create calendar event in Outlook
    const eventId = await createCalendarEvent(session.user.id, {
      subject: `Meeting with ${contact.name}${contact.organization ? ` - ${contact.organization}` : ""}`,
      start: startTime,
      end: endTime,
      attendeeEmail: contact.email,
    });

    // Update contact status to MEETING_SCHEDULED
    await prisma.contact.update({
      where: { id: contactId },
      data: { status: "MEETING_SCHEDULED" },
    });

    return NextResponse.json({
      eventId,
      contact: {
        id: contact.id,
        name: contact.name,
        status: "MEETING_SCHEDULED",
      },
      meeting: {
        start: startTime.toISOString(),
        end: endTime.toISOString(),
        duration,
      },
    });
  } catch (error) {
    console.error("[meeting/confirm] Failed to create calendar event:", error);
    return NextResponse.json(
      {
        error: "Failed to create calendar event. Please check your Microsoft connection.",
      },
      { status: 500 },
    );
  }
}
