import { prisma } from "../src/lib/db";

/**
 * One-off cleanup: deletes buyer contacts with no outreach attached — these
 * are dead rows left by draft attempts that failed after the contact was
 * created but before the email/outreach was (fixed in api/buyer/draft by
 * generating the email before creating the contact).
 */
async function main() {
  const orphans = await prisma.contact.findMany({
    where: { kind: "buyer", outreaches: { none: {} } },
    select: { id: true, name: true, organization: true },
  });
  console.log(`Deleting ${orphans.length} orphaned buyer contacts:`);
  for (const c of orphans) console.log(`- ${c.name} (${c.organization})`);

  const result = await prisma.contact.deleteMany({
    where: { id: { in: orphans.map((o) => o.id) } },
  });
  console.log(`Deleted ${result.count}.`);
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
