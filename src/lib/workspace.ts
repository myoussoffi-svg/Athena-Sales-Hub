import { cookies } from "next/headers";
import { prisma } from "./db";
import { auth } from "./auth";
import { redirect } from "next/navigation";

const WORKSPACE_COOKIE = "active-workspace";

export async function getActiveWorkspaceId(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(WORKSPACE_COOKIE)?.value ?? null;
}

export async function setActiveWorkspace(workspaceId: string) {
  const cookieStore = await cookies();
  cookieStore.set(WORKSPACE_COOKIE, workspaceId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365, // 1 year
  });
}

export async function getUserWorkspaces(userId: string) {
  const memberships = await prisma.workspaceMember.findMany({
    where: { userId },
    include: { workspace: true },
    orderBy: { workspace: { name: "asc" } },
  });
  return memberships.map((m: typeof memberships[number]) => ({
    ...m.workspace,
    role: m.role,
  }));
}

export async function requireWorkspace() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const workspaceId = await getActiveWorkspaceId();
  if (!workspaceId) {
    redirect("/select-workspace");
  }

  // Verify user has access to this workspace
  const membership = await prisma.workspaceMember.findUnique({
    where: {
      workspaceId_userId: {
        workspaceId,
        userId: session.user.id,
      },
    },
    include: { workspace: true },
  });

  if (!membership) {
    redirect("/select-workspace");
  }

  return {
    user: session.user,
    workspace: membership.workspace,
    workspaceRole: membership.role,
  };
}

export async function requireAuth() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }
  return session.user;
}
