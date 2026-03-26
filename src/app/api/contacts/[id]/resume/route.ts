import { NextRequest, NextResponse } from "next/server";
import { put, del } from "@vercel/blob";
import { prisma } from "@/lib/db";
import { requireWorkspaceApi } from "@/lib/workspace";

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

  const formData = await request.formData();
  const file = formData.get("file") as File | null;

  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  // Validate file type
  const allowedTypes = [
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ];
  if (!allowedTypes.includes(file.type)) {
    return NextResponse.json(
      { error: "Only PDF and Word documents are allowed" },
      { status: 400 },
    );
  }

  // Max 10MB
  if (file.size > 10 * 1024 * 1024) {
    return NextResponse.json(
      { error: "File must be under 10MB" },
      { status: 400 },
    );
  }

  // Delete old resume if exists
  if (contact.resumeUrl) {
    try {
      await del(contact.resumeUrl);
    } catch {
      // Old blob may already be gone
    }
  }

  // Upload to Vercel Blob
  const blob = await put(`resumes/${id}/${file.name}`, file, {
    access: "public",
  });

  // Update contact record
  const updated = await prisma.contact.update({
    where: { id },
    data: {
      resumeUrl: blob.url,
      resumeName: file.name,
    },
  });

  return NextResponse.json({
    resumeUrl: updated.resumeUrl,
    resumeName: updated.resumeName,
  });
}

export async function DELETE(
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

  if (contact.resumeUrl) {
    try {
      await del(contact.resumeUrl);
    } catch {
      // Blob may already be gone
    }
  }

  await prisma.contact.update({
    where: { id },
    data: {
      resumeUrl: null,
      resumeName: null,
    },
  });

  return NextResponse.json({ ok: true });
}
