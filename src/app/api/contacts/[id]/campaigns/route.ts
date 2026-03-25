import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireWorkspaceApi } from "@/lib/workspace";

// GET: list all campaign links for a contact
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const result = await requireWorkspaceApi();
  if ("error" in result) return result.error;
  const { workspaceId } = result;
  const { id } = await params;

  const contact = await prisma.contact.findFirst({
    where: { id, workspaceId },
  });
  if (!contact) {
    return NextResponse.json({ error: "Contact not found" }, { status: 404 });
  }

  const links = await prisma.campaignContact.findMany({
    where: { contactId: id },
    include: { campaign: { select: { id: true, name: true, status: true } } },
    orderBy: { addedAt: "desc" },
  });

  return NextResponse.json(links);
}

// POST: add contact to a campaign
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const result = await requireWorkspaceApi();
  if ("error" in result) return result.error;
  const { workspaceId } = result;
  const { id } = await params;

  const contact = await prisma.contact.findFirst({
    where: { id, workspaceId },
  });
  if (!contact) {
    return NextResponse.json({ error: "Contact not found" }, { status: 404 });
  }

  const body = await request.json();
  const { campaignId, note } = body;

  if (!campaignId) {
    return NextResponse.json({ error: "campaignId is required" }, { status: 400 });
  }

  // Verify campaign belongs to workspace
  const campaign = await prisma.campaign.findFirst({
    where: { id: campaignId, workspaceId },
  });
  if (!campaign) {
    return NextResponse.json({ error: "Campaign not found in this workspace" }, { status: 400 });
  }

  const link = await prisma.campaignContact.upsert({
    where: { campaignId_contactId: { campaignId, contactId: id } },
    update: { note: note || null },
    create: { campaignId, contactId: id, note: note || null },
    include: { campaign: { select: { id: true, name: true, status: true } } },
  });

  return NextResponse.json(link, { status: 201 });
}

// PATCH: update note on a campaign link
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const result = await requireWorkspaceApi();
  if ("error" in result) return result.error;
  const { workspaceId } = result;
  const { id } = await params;

  const contact = await prisma.contact.findFirst({
    where: { id, workspaceId },
  });
  if (!contact) {
    return NextResponse.json({ error: "Contact not found" }, { status: 404 });
  }

  const body = await request.json();
  const { campaignId, note } = body;

  if (!campaignId) {
    return NextResponse.json({ error: "campaignId is required" }, { status: 400 });
  }

  const existing = await prisma.campaignContact.findUnique({
    where: { campaignId_contactId: { campaignId, contactId: id } },
  });
  if (!existing) {
    return NextResponse.json({ error: "Contact not in this campaign" }, { status: 404 });
  }

  const link = await prisma.campaignContact.update({
    where: { id: existing.id },
    data: { note: note ?? null },
    include: { campaign: { select: { id: true, name: true, status: true } } },
  });

  return NextResponse.json(link);
}

// DELETE: remove contact from a campaign
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const result = await requireWorkspaceApi();
  if ("error" in result) return result.error;
  const { workspaceId } = result;
  const { id } = await params;

  const contact = await prisma.contact.findFirst({
    where: { id, workspaceId },
  });
  if (!contact) {
    return NextResponse.json({ error: "Contact not found" }, { status: 404 });
  }

  const { searchParams } = request.nextUrl;
  const campaignId = searchParams.get("campaignId");
  if (!campaignId) {
    return NextResponse.json({ error: "campaignId is required" }, { status: 400 });
  }

  await prisma.campaignContact.deleteMany({
    where: { campaignId, contactId: id },
  });

  return NextResponse.json({ ok: true });
}
