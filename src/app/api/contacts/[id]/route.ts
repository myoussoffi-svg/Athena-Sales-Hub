import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getActiveWorkspaceId } from "@/lib/workspace";
import { ContactStatus, OutreachStatus } from "@/generated/prisma/client";

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
    return NextResponse.json({ error: "No workspace selected" }, { status: 400 });
  }

  const { id } = await params;

  const contact = await prisma.contact.findFirst({
    where: { id, workspaceId },
    include: {
      campaign: { select: { id: true, name: true } },
      assignedTo: { select: { id: true, name: true, email: true } },
      outreaches: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          type: true,
          status: true,
          subject: true,
          sentAt: true,
          scheduledAt: true,
          createdAt: true,
        },
      },
    },
  });

  if (!contact) {
    return NextResponse.json({ error: "Contact not found" }, { status: 404 });
  }

  return NextResponse.json(contact);
}

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
    return NextResponse.json({ error: "No workspace selected" }, { status: 400 });
  }

  const { id } = await params;

  const existing = await prisma.contact.findFirst({
    where: { id, workspaceId },
  });
  if (!existing) {
    return NextResponse.json({ error: "Contact not found" }, { status: 404 });
  }

  const body = await request.json();

  // ── Action: Mark as Bounced ─────────────────────────────────────
  if (body.action === "mark_bounced") {
    await prisma.contact.update({
      where: { id },
      data: { status: ContactStatus.BOUNCED },
    });

    // Cancel all non-sent outreach
    const cancelled = await prisma.outreach.updateMany({
      where: {
        contactId: id,
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

    const updated = await prisma.contact.findUnique({
      where: { id },
      include: {
        campaign: { select: { id: true, name: true } },
        _count: { select: { outreaches: true } },
      },
    });

    return NextResponse.json({
      ...updated,
      cancelledOutreaches: cancelled.count,
    });
  }

  const {
    name,
    email,
    title,
    organization,
    orgType,
    location,
    notes,
    websiteUrl,
    status,
    campaignId,
  } = body;

  // Verify campaign if being changed
  if (campaignId !== undefined && campaignId !== null) {
    const campaign = await prisma.campaign.findFirst({
      where: { id: campaignId, workspaceId },
    });
    if (!campaign) {
      return NextResponse.json(
        { error: "Campaign not found in this workspace" },
        { status: 400 },
      );
    }
  }

  const contact = await prisma.contact.update({
    where: { id },
    data: {
      ...(name !== undefined && { name }),
      ...(email !== undefined && { email }),
      ...(title !== undefined && { title }),
      ...(organization !== undefined && { organization }),
      ...(orgType !== undefined && { orgType }),
      ...(location !== undefined && { location }),
      ...(notes !== undefined && { notes }),
      ...(websiteUrl !== undefined && { websiteUrl }),
      ...(status !== undefined && { status }),
      ...(campaignId !== undefined && { campaignId }),
    },
    include: {
      campaign: { select: { id: true, name: true } },
      _count: { select: { outreaches: true } },
    },
  });

  return NextResponse.json(contact);
}

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
    return NextResponse.json({ error: "No workspace selected" }, { status: 400 });
  }

  const { id } = await params;

  const existing = await prisma.contact.findFirst({
    where: { id, workspaceId },
  });
  if (!existing) {
    return NextResponse.json({ error: "Contact not found" }, { status: 404 });
  }

  await prisma.contact.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}
