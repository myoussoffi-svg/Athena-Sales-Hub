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

  const samples = await prisma.voiceSample.findMany({
    where: { userId: session.user.id, workspaceId },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ samples });
}

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
  const { sampleText } = body as { sampleText: string };

  if (!sampleText || sampleText.trim().length === 0) {
    return NextResponse.json(
      { error: "sampleText is required" },
      { status: 400 },
    );
  }

  const sample = await prisma.voiceSample.create({
    data: {
      userId: session.user.id,
      workspaceId,
      sampleText: sampleText.trim(),
    },
  });

  return NextResponse.json({ sample }, { status: 201 });
}

export async function DELETE(request: NextRequest) {
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

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json(
      { error: "id query parameter is required" },
      { status: 400 },
    );
  }

  // Verify ownership before deleting
  const sample = await prisma.voiceSample.findFirst({
    where: { id, userId: session.user.id, workspaceId },
  });

  if (!sample) {
    return NextResponse.json(
      { error: "Voice sample not found" },
      { status: 404 },
    );
  }

  await prisma.voiceSample.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
