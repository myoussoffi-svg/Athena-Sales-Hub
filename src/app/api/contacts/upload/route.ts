import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getActiveWorkspaceId } from "@/lib/workspace";
import Papa from "papaparse";

interface CsvRow {
  name?: string;
  email?: string;
  title?: string;
  organization?: string;
  orgType?: string;
  location?: string;
  notes?: string;
  websiteUrl?: string;
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

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  const campaignId = formData.get("campaignId") as string | null;

  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
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

  // Strip BOM from raw text before parsing
  const rawText = await file.text();
  const text = rawText.replace(/^\uFEFF/, "");

  const { data, errors } = Papa.parse<CsvRow>(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (header: string) => header.trim().toLowerCase(),
  });

  if (errors.length > 0 && data.length === 0) {
    return NextResponse.json(
      { error: "Failed to parse CSV", details: errors },
      { status: 400 },
    );
  }

  // Filter valid rows (must have name and email)
  const validRows = data.filter(
    (row) => row.name?.trim() && row.email?.trim(),
  );

  if (validRows.length === 0) {
    return NextResponse.json(
      { error: "No valid rows found. Each row must have name and email." },
      { status: 400 },
    );
  }

  const contacts = await prisma.contact.createMany({
    data: validRows.map((row) => ({
      name: row.name!.trim(),
      email: row.email!.trim(),
      title: row.title?.trim() || null,
      organization: row.organization?.trim() || null,
      orgType: row.orgType?.trim() || null,
      location: row.location?.trim() || null,
      notes: row.notes?.trim() || null,
      websiteUrl: row.websiteUrl?.trim() || null,
      workspaceId,
      assignedToId: session.user.id,
      campaignId: campaignId || null,
    })),
    skipDuplicates: true,
  });

  return NextResponse.json({
    created: contacts.count,
    total: validRows.length,
    skipped: data.length - validRows.length,
  });
}
