import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { encrypt } from "@/lib/encryption";
import { startWarmup, pauseWarmup, checkDomainDNS } from "@/lib/warmup-agent";
import { getActiveWorkspaceId } from "@/lib/workspace";

export async function GET(
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

  const domain = await prisma.sendingDomain.findFirst({
    where: { id, workspaceId },
    include: {
      warmupLogs: {
        orderBy: { date: "desc" },
        take: 30,
      },
      _count: {
        select: { outreaches: true },
      },
    },
  });

  if (!domain) {
    return NextResponse.json({ error: "Domain not found" }, { status: 404 });
  }

  return NextResponse.json(domain);
}

export async function PATCH(
  request: NextRequest,
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

  // Verify domain belongs to workspace
  const existing = await prisma.sendingDomain.findFirst({
    where: { id, workspaceId },
  });
  if (!existing) {
    return NextResponse.json({ error: "Domain not found" }, { status: 404 });
  }

  const body = await request.json();

  // Handle actions
  if (body.action) {
    switch (body.action) {
      case "start_warmup": {
        await startWarmup(id);
        const updated = await prisma.sendingDomain.findUnique({ where: { id } });
        return NextResponse.json(updated);
      }

      case "pause_warmup": {
        await pauseWarmup(id);
        const updated = await prisma.sendingDomain.findUnique({ where: { id } });
        return NextResponse.json(updated);
      }

      case "check_dns": {
        const dnsResult = await checkDomainDNS(existing.domain);
        const updated = await prisma.sendingDomain.update({
          where: { id },
          data: {
            spfVerified: dnsResult.spf,
            dkimVerified: dnsResult.dkim,
            dmarcVerified: dnsResult.dmarc,
          },
        });
        return NextResponse.json(updated);
      }

      default:
        return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }
  }

  // Handle regular field updates
  const { smtpHost, smtpPort, smtpUser, smtpPass, displayName } = body;

  const updateData: Record<string, unknown> = {};
  if (smtpHost !== undefined) updateData.smtpHost = smtpHost;
  if (smtpPort !== undefined) updateData.smtpPort = parseInt(smtpPort, 10);
  if (smtpUser !== undefined) updateData.smtpUser = smtpUser;
  if (smtpPass !== undefined) updateData.smtpPass = encrypt(smtpPass);
  if (displayName !== undefined) updateData.displayName = displayName;

  const updated = await prisma.sendingDomain.update({
    where: { id },
    data: updateData,
  });

  return NextResponse.json(updated);
}

export async function DELETE(
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

  const existing = await prisma.sendingDomain.findFirst({
    where: { id, workspaceId },
    include: {
      _count: { select: { outreaches: true } },
    },
  });

  if (!existing) {
    return NextResponse.json({ error: "Domain not found" }, { status: 404 });
  }

  if (existing._count.outreaches > 0) {
    return NextResponse.json(
      { error: "Cannot delete a domain that has been used for outreach. Remove or reassign outreaches first." },
      { status: 400 },
    );
  }

  await prisma.sendingDomain.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}
