import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireWorkspaceApi } from "@/lib/workspace";

export async function GET(request: NextRequest) {
  const result = await requireWorkspaceApi();
  if ("error" in result) return result.error;
  const { workspaceId } = result;

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
