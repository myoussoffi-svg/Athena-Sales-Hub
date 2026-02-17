import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { encrypt } from "@/lib/encryption";
import { checkDomainDNS } from "@/lib/warmup-agent";
import { getActiveWorkspaceId } from "@/lib/workspace";

export async function GET() {
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

  // Get today's date at midnight for warmup log lookup
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const domains = await prisma.sendingDomain.findMany({
    where: { workspaceId },
    include: {
      warmupLogs: {
        where: { date: today },
        take: 1,
      },
      _count: {
        select: { outreaches: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  // Transform to include today's log data at top level
  const result = domains.map((domain: typeof domains[number]) => {
    const todayLog = domain.warmupLogs[0] ?? null;
    const { warmupLogs, ...rest } = domain;
    return {
      ...rest,
      todaySent: todayLog?.emailsSent ?? 0,
      todayBounces: todayLog?.bounces ?? 0,
    };
  });

  return NextResponse.json(result);
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

  const body = await request.json();
  const { domain, emailAddress, displayName, smtpHost, smtpPort, smtpUser, smtpPass } = body;

  if (!domain || !emailAddress) {
    return NextResponse.json(
      { error: "Domain and email address are required" },
      { status: 400 },
    );
  }

  // Encrypt SMTP password before storing
  const encryptedPass = smtpPass ? encrypt(smtpPass) : null;

  // Run DNS check
  let dnsResult = { spf: false, dkim: false, dmarc: false };
  try {
    dnsResult = await checkDomainDNS(domain);
  } catch (error) {
    console.error(`[domains] DNS check failed for ${domain}:`, error);
  }

  const sendingDomain = await prisma.sendingDomain.create({
    data: {
      workspaceId,
      domain,
      emailAddress,
      displayName: displayName || null,
      smtpHost: smtpHost || null,
      smtpPort: smtpPort ? parseInt(smtpPort, 10) : 587,
      smtpUser: smtpUser || null,
      smtpPass: encryptedPass,
      spfVerified: dnsResult.spf,
      dkimVerified: dnsResult.dkim,
      dmarcVerified: dnsResult.dmarc,
    },
  });

  return NextResponse.json(sendingDomain, { status: 201 });
}
