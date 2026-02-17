import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getActiveWorkspaceId } from "@/lib/workspace";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const workspaceId = await getActiveWorkspaceId();
  if (!workspaceId) {
    return NextResponse.json({ error: "No workspace selected" }, { status: 400 });
  }

  const membership = await prisma.workspaceMember.findUnique({
    where: {
      workspaceId_userId: { workspaceId, userId: session.user.id },
    },
  });
  if (!membership) {
    return NextResponse.json({ error: "Not a member" }, { status: 403 });
  }

  const { searchParams } = request.nextUrl;
  const campaignId = searchParams.get("campaignId");
  const status = searchParams.get("status");
  const search = searchParams.get("search");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: Record<string, any> = { workspaceId };
  if (campaignId) where.campaignId = campaignId;
  if (status) where.status = status;
  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { email: { contains: search, mode: "insensitive" } },
      { organization: { contains: search, mode: "insensitive" } },
    ];
  }

  const contacts = await prisma.contact.findMany({
    where,
    include: {
      campaign: {
        select: { id: true, name: true },
      },
      _count: {
        select: { outreaches: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(contacts);
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const workspaceId = await getActiveWorkspaceId();
  if (!workspaceId) {
    return NextResponse.json({ error: "No workspace selected" }, { status: 400 });
  }

  const membership = await prisma.workspaceMember.findUnique({
    where: {
      workspaceId_userId: { workspaceId, userId: session.user.id },
    },
  });
  if (!membership) {
    return NextResponse.json({ error: "Not a member" }, { status: 403 });
  }

  const body = await request.json();
  const {
    name,
    email,
    title,
    organization,
    orgType,
    location,
    notes,
    websiteUrl,
    campaignId,
  } = body;

  if (!name || !email) {
    return NextResponse.json(
      { error: "Name and email are required" },
      { status: 400 },
    );
  }

  // Verify campaign belongs to workspace if provided
  if (campaignId) {
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

  const contact = await prisma.contact.create({
    data: {
      name,
      email,
      title: title || null,
      organization: organization || null,
      orgType: orgType || null,
      location: location || null,
      notes: notes || null,
      websiteUrl: websiteUrl || null,
      campaignId: campaignId || null,
      workspaceId,
      assignedToId: session.user.id,
    },
    include: {
      campaign: { select: { id: true, name: true } },
      _count: { select: { outreaches: true } },
    },
  });

  return NextResponse.json(contact, { status: 201 });
}
