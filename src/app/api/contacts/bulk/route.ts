import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getActiveWorkspaceId } from "@/lib/workspace";
import { ContactStatus, OutreachStatus } from "@/generated/prisma/client";

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
  const { contactIds, action, status } = body as {
    contactIds: string[];
    action: "delete" | "update_status";
    status?: string;
  };

  if (!contactIds || contactIds.length === 0) {
    return NextResponse.json(
      { error: "No contacts selected" },
      { status: 400 },
    );
  }

  // Verify all contacts belong to this workspace
  const count = await prisma.contact.count({
    where: { id: { in: contactIds }, workspaceId },
  });
  if (count !== contactIds.length) {
    return NextResponse.json(
      { error: "Some contacts not found in this workspace" },
      { status: 400 },
    );
  }

  if (action === "delete") {
    await prisma.contact.deleteMany({
      where: { id: { in: contactIds }, workspaceId },
    });

    return NextResponse.json({ deleted: contactIds.length });
  }

  if (action === "update_status" && status) {
    const validStatuses = Object.values(ContactStatus);
    if (!validStatuses.includes(status as ContactStatus)) {
      return NextResponse.json(
        { error: "Invalid status" },
        { status: 400 },
      );
    }

    await prisma.contact.updateMany({
      where: { id: { in: contactIds }, workspaceId },
      data: { status: status as ContactStatus },
    });

    // If marking as bounced, cancel pending outreach
    if (status === "BOUNCED") {
      await prisma.outreach.updateMany({
        where: {
          contactId: { in: contactIds },
          status: {
            in: [
              OutreachStatus.SCHEDULED,
              OutreachStatus.DRAFT_CREATED,
              OutreachStatus.APPROVED,
            ],
          },
        },
        data: { status: OutreachStatus.CANCELLED },
      });
    }

    return NextResponse.json({ updated: contactIds.length });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
