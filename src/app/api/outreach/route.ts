import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getActiveWorkspaceId } from "@/lib/workspace";

export async function GET(request: NextRequest) {
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
  const campaignId = searchParams.get("campaignId");
  const status = searchParams.get("status");
  const userId = searchParams.get("userId");

  const outreaches = await prisma.outreach.findMany({
    where: {
      user: {
        workspaces: {
          some: { workspaceId },
        },
      },
      ...(campaignId && { campaignId }),
      ...(status && { status: status as never }),
      ...(userId && { userId }),
    },
    include: {
      contact: {
        select: {
          id: true,
          name: true,
          email: true,
          title: true,
          organization: true,
        },
      },
      campaign: {
        select: {
          id: true,
          name: true,
          type: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(outreaches);
}
