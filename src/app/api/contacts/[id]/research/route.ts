import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getActiveWorkspaceId } from "@/lib/workspace";
import { enrichContactWithResearch } from "@/lib/research-agent";

export async function POST(
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

  // Verify contact belongs to workspace
  const contact = await prisma.contact.findFirst({
    where: { id, workspaceId },
  });

  if (!contact) {
    return NextResponse.json({ error: "Contact not found" }, { status: 404 });
  }

  if (!contact.websiteUrl) {
    return NextResponse.json(
      { error: "Contact has no website URL for research" },
      { status: 400 },
    );
  }

  await enrichContactWithResearch(id);

  // Fetch updated contact with research data
  const updated = await prisma.contact.findUnique({
    where: { id },
    select: {
      id: true,
      researchData: true,
      status: true,
    },
  });

  return NextResponse.json(updated);
}
