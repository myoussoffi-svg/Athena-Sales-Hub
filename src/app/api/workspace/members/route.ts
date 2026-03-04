import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireWorkspaceApi } from "@/lib/workspace";

// GET — list members + pending invitations
export async function GET() {
  const result = await requireWorkspaceApi();
  if ("error" in result) return result.error;
  const { workspaceId, membership } = result;

  if (membership.role !== "ADMIN") {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const [members, invitations] = await Promise.all([
    prisma.workspaceMember.findMany({
      where: { workspaceId },
      include: {
        user: { select: { id: true, name: true, email: true, image: true, role: true } },
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.workspaceInvitation.findMany({
      where: { workspaceId },
      include: {
        invitedBy: { select: { name: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return NextResponse.json({ members, invitations });
}

// POST — invite a user by email
export async function POST(request: NextRequest) {
  const result = await requireWorkspaceApi();
  if ("error" in result) return result.error;
  const { user: sessionUser, workspaceId, membership } = result;

  if (membership.role !== "ADMIN") {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const body = await request.json();
  const { email, role = "MEMBER" } = body as { email: string; role?: string };

  if (!email || typeof email !== "string") {
    return NextResponse.json({ error: "Email is required" }, { status: 400 });
  }

  const normalizedEmail = email.toLowerCase().trim();

  if (!["ADMIN", "MEMBER"].includes(role)) {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }

  // Check if already a member
  const existingMember = await prisma.workspaceMember.findFirst({
    where: { workspaceId, user: { email: normalizedEmail } },
  });
  if (existingMember) {
    return NextResponse.json({ error: "User is already a member" }, { status: 409 });
  }

  // Check if already invited
  const existingInvite = await prisma.workspaceInvitation.findUnique({
    where: { workspaceId_email: { workspaceId, email: normalizedEmail } },
  });
  if (existingInvite) {
    return NextResponse.json({ error: "Invitation already pending" }, { status: 409 });
  }

  // If user exists in DB, add them directly as a member
  const existingUser = await prisma.user.findUnique({
    where: { email: normalizedEmail },
  });

  if (existingUser) {
    const member = await prisma.workspaceMember.create({
      data: {
        workspaceId,
        userId: existingUser.id,
        role: role as "ADMIN" | "MEMBER",
      },
      include: {
        user: { select: { id: true, name: true, email: true, image: true, role: true } },
      },
    });
    return NextResponse.json({ type: "member_added", member }, { status: 201 });
  }

  // User doesn't exist yet — create invitation for when they sign in
  const invitation = await prisma.workspaceInvitation.create({
    data: {
      workspaceId,
      email: normalizedEmail,
      role: role as "ADMIN" | "MEMBER",
      invitedById: sessionUser.id,
    },
    include: {
      invitedBy: { select: { name: true, email: true } },
    },
  });

  return NextResponse.json({ type: "invitation_created", invitation }, { status: 201 });
}
