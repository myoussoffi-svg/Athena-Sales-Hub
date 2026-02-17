import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getActiveWorkspaceId } from "@/lib/workspace";

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

  const campaign = await prisma.campaign.findFirst({
    where: { id, workspaceId },
    include: {
      _count: {
        select: { contacts: true, outreaches: true },
      },
      createdBy: {
        select: { id: true, name: true, email: true },
      },
    },
  });

  if (!campaign) {
    return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
  }

  // Get outreach stats breakdown
  const outreachStats = await prisma.outreach.groupBy({
    by: ["status"],
    where: { campaignId: id, campaign: { workspaceId } },
    _count: { status: true },
  });

  return NextResponse.json({ ...campaign, outreachStats });
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

  // Verify campaign belongs to workspace
  const existing = await prisma.campaign.findFirst({
    where: { id, workspaceId },
  });
  if (!existing) {
    return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
  }

  const body = await request.json();
  const { name, description, status, cadenceConfig } = body;

  const campaign = await prisma.campaign.update({
    where: { id },
    data: {
      ...(name !== undefined && { name }),
      ...(description !== undefined && { description }),
      ...(status !== undefined && { status }),
      ...(cadenceConfig !== undefined && { cadenceConfig }),
    },
    include: {
      _count: {
        select: { contacts: true, outreaches: true },
      },
    },
  });

  return NextResponse.json(campaign);
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

  const existing = await prisma.campaign.findFirst({
    where: { id, workspaceId },
  });
  if (!existing) {
    return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
  }

  if (existing.status !== "DRAFT") {
    return NextResponse.json(
      { error: "Only DRAFT campaigns can be deleted" },
      { status: 400 },
    );
  }

  await prisma.campaign.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}
