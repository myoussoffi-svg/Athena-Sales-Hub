import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireWorkspaceApi } from "@/lib/workspace";

// PATCH — update member role
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const result = await requireWorkspaceApi();
  if ("error" in result) return result.error;
  const { user: sessionUser, workspaceId, membership } = result;

  if (membership.role !== "ADMIN") {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json();
  const { role } = body as { role: string };

  if (!["ADMIN", "MEMBER"].includes(role)) {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }

  // Find the target member
  const target = await prisma.workspaceMember.findFirst({
    where: { id, workspaceId },
    include: { user: { select: { role: true } } },
  });

  if (!target) {
    return NextResponse.json({ error: "Member not found" }, { status: 404 });
  }

  // Can't change own role
  if (target.userId === sessionUser.id) {
    return NextResponse.json({ error: "Cannot change your own role" }, { status: 400 });
  }

  // Can't change OWNER's workspace role
  if (target.user.role === "OWNER") {
    return NextResponse.json({ error: "Cannot change the owner's role" }, { status: 400 });
  }

  const updated = await prisma.workspaceMember.update({
    where: { id },
    data: { role: role as "ADMIN" | "MEMBER" },
    include: {
      user: { select: { id: true, name: true, email: true, image: true, role: true } },
    },
  });

  return NextResponse.json(updated);
}

// DELETE — remove member or cancel invitation
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const result = await requireWorkspaceApi();
  if ("error" in result) return result.error;
  const { user: sessionUser, workspaceId, membership } = result;

  if (membership.role !== "ADMIN") {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const { id } = await params;

  // Try to find as a member first
  const member = await prisma.workspaceMember.findFirst({
    where: { id, workspaceId },
    include: { user: { select: { role: true } } },
  });

  if (member) {
    // Can't remove self
    if (member.userId === sessionUser.id) {
      return NextResponse.json({ error: "Cannot remove yourself" }, { status: 400 });
    }
    // Can't remove OWNER
    if (member.user.role === "OWNER") {
      return NextResponse.json({ error: "Cannot remove the owner" }, { status: 400 });
    }

    await prisma.workspaceMember.delete({ where: { id } });
    return NextResponse.json({ ok: true, type: "member_removed" });
  }

  // Try as an invitation
  const invitation = await prisma.workspaceInvitation.findFirst({
    where: { id, workspaceId },
  });

  if (invitation) {
    await prisma.workspaceInvitation.delete({ where: { id } });
    return NextResponse.json({ ok: true, type: "invitation_cancelled" });
  }

  return NextResponse.json({ error: "Not found" }, { status: 404 });
}
