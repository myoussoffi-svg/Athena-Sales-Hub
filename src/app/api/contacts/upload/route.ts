import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireWorkspaceApi } from "@/lib/workspace";
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
  const result = await requireWorkspaceApi();
  if ("error" in result) return result.error;
  const { user: sessionUser, workspaceId } = result;

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

  // Map column headers to our exact CsvRow field names. Targets MUST match the
  // camelCase keys read below (websiteUrl, orgType) — otherwise the value is
  // silently dropped. Headers are trimmed + lowercased before lookup.
  const headerAliases: Record<string, string> = {
    // name (the person / owner)
    name: "name",
    "owner name": "name",
    owner: "name",
    "contact name": "name",
    "full name": "name",
    "organization name": "name",
    "org name": "name",
    // email
    email: "email",
    "contact email": "email",
    "email address": "email",
    // organization (the company)
    organization: "organization",
    company: "organization",
    "company name": "organization",
    "university / school": "organization",
    university: "organization",
    school: "organization",
    // websiteUrl (the company website)
    website: "websiteUrl",
    "company website": "websiteUrl",
    "website url": "websiteUrl",
    websiteurl: "websiteUrl",
    url: "websiteUrl",
    "linkedin / website": "websiteUrl",
    linkedin: "websiteUrl",
    // orgType
    "org type": "orgType",
    type: "orgType",
    orgtype: "orgType",
  };

  const { data, errors } = Papa.parse<CsvRow>(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (header: string) => {
      const normalized = header.trim().toLowerCase();
      return headerAliases[normalized] || normalized;
    },
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
      assignedToId: sessionUser.id,
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
