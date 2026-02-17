import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getActiveWorkspaceId } from "@/lib/workspace";

export async function GET() {
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

  // Verify membership
  const membership = await prisma.workspaceMember.findUnique({
    where: {
      workspaceId_userId: { workspaceId, userId: session.user.id },
    },
  });

  if (!membership) {
    return NextResponse.json({ error: "Not a member" }, { status: 403 });
  }

  const workspace = await prisma.workspace.findUniqueOrThrow({
    where: { id: workspaceId },
    select: {
      aiSystemPrompt: true,
      campaignTypes: true,
      settings: true,
    },
  });

  return NextResponse.json(workspace);
}

export async function PATCH(request: NextRequest) {
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

  // Only ADMIN can update workspace settings
  const membership = await prisma.workspaceMember.findUnique({
    where: {
      workspaceId_userId: { workspaceId, userId: session.user.id },
    },
  });

  if (!membership || membership.role !== "ADMIN") {
    return NextResponse.json(
      { error: "Only workspace admins can update settings" },
      { status: 403 },
    );
  }

  const body = await request.json();
  const { aiSystemPrompt, campaignTypes, settings } = body as {
    aiSystemPrompt?: string;
    campaignTypes?: string[];
    settings?: Record<string, unknown>;
  };

  const updateData: Record<string, unknown> = {};

  if (aiSystemPrompt !== undefined) {
    updateData.aiSystemPrompt = aiSystemPrompt;
  }

  if (campaignTypes !== undefined) {
    updateData.campaignTypes = campaignTypes;
  }

  if (settings !== undefined) {
    // Merge with existing settings
    const existing = await prisma.workspace.findUniqueOrThrow({
      where: { id: workspaceId },
      select: { settings: true },
    });

    const existingSettings =
      (existing.settings as Record<string, unknown>) ?? {};
    updateData.settings = { ...existingSettings, ...settings };
  }

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json(
      { error: "No fields to update" },
      { status: 400 },
    );
  }

  const workspace = await prisma.workspace.update({
    where: { id: workspaceId },
    data: updateData,
    select: {
      aiSystemPrompt: true,
      campaignTypes: true,
      settings: true,
    },
  });

  return NextResponse.json(workspace);
}
