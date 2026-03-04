import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireWorkspaceApi } from "@/lib/workspace";
import { enrichContactWithResearch } from "@/lib/research-agent";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const result = await requireWorkspaceApi();
  if ("error" in result) return result.error;
  const { workspaceId } = result;

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
