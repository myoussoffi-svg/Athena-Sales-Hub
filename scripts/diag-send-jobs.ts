import { prisma } from "../src/lib/db";

async function main() {
  // Job queue breakdown
  const jobs = await prisma.jobQueue.groupBy({
    by: ["type", "status"],
    _count: { _all: true },
  });
  console.log("=== JobQueue (type / status / count) ===");
  for (const j of jobs) {
    console.log(`  ${j.type} / ${j.status}: ${j._count._all}`);
  }

  // Recent send_email jobs detail
  const sendJobs = await prisma.jobQueue.findMany({
    where: { type: "send_email" },
    orderBy: { createdAt: "desc" },
    take: 10,
    select: {
      status: true,
      attempts: true,
      runAfter: true,
      startedAt: true,
      completedAt: true,
      lastError: true,
      createdAt: true,
    },
  });
  console.log("\n=== Recent send_email jobs ===");
  for (const j of sendJobs) {
    console.log(
      `  status=${j.status} attempts=${j.attempts} created=${j.createdAt.toISOString()} runAfter=${j.runAfter?.toISOString() ?? "-"} started=${j.startedAt?.toISOString() ?? "-"} done=${j.completedAt?.toISOString() ?? "-"}${j.lastError ? ` err=${j.lastError.slice(0, 120)}` : ""}`,
    );
  }

  // Outreach status breakdown
  const outreach = await prisma.outreach.groupBy({
    by: ["status"],
    _count: { _all: true },
  });
  console.log("\n=== Outreach by status ===");
  for (const o of outreach) {
    console.log(`  ${o.status}: ${o._count._all}`);
  }

  console.log("\n=== Server clock ===");
  console.log("  now:", new Date().toISOString(), "| local hour:", new Date().getHours());
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
