import { prisma } from "../src/lib/db";

async function main() {
  const workspaces = await prisma.workspace.findMany({
    select: { id: true, name: true, slug: true },
  });

  for (const ws of workspaces) {
    const [domains, campaigns, contacts] = await Promise.all([
      prisma.sendingDomain.findMany({
        where: { workspaceId: ws.id },
        select: {
          emailAddress: true,
          warmupStatus: true,
          dailySendLimit: true,
          smtpHost: true,
        },
      }),
      prisma.campaign.count({ where: { workspaceId: ws.id } }),
      prisma.contact.count({ where: { workspaceId: ws.id } }),
    ]);
    console.log(`\n=== Workspace: ${ws.name} (slug=${ws.slug}) ===`);
    console.log(`  campaigns=${campaigns}  contacts=${contacts}`);
    console.log(`  sendingDomains (${domains.length}):`);
    for (const d of domains) {
      console.log(
        `    - ${d.emailAddress}  status=${d.warmupStatus}  smtp=${d.smtpHost ? "yes" : "no"}  limit=${d.dailySendLimit}`,
      );
    }
    const readySmtp = domains.filter(
      (d) => d.warmupStatus === "READY" && d.smtpHost,
    );
    console.log(
      `  >> READY+SMTP domains that would hijack personal sends: ${readySmtp.length}`,
    );
  }

  const users = await prisma.user.findMany({
    select: {
      email: true,
      microsoftRefreshToken: true,
      tokenExpiry: true,
    },
  });
  console.log(`\n=== Users (${users.length}) ===`);
  for (const u of users) {
    console.log(
      `  - ${u.email}  connected=${!!u.microsoftRefreshToken}  tokenExpiry=${u.tokenExpiry?.toISOString() ?? "none"}`,
    );
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
