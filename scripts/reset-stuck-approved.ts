import { prisma } from "../src/lib/db";

/**
 * One-off cleanup: the old flow left approved emails stuck as PENDING queue
 * jobs that the (non-running) cron never sent. Delete those stale jobs and put
 * their outreaches back to DRAFT_CREATED so they return to the review queue and
 * can be re-approved under the new send-on-approve flow.
 */
async function main() {
  const pendingJobs = await prisma.jobQueue.findMany({
    where: { type: "send_email", status: "PENDING" },
    select: { id: true, payload: true },
  });

  const outreachIds = pendingJobs
    .map((j) => (j.payload as { outreachId?: string })?.outreachId)
    .filter((v): v is string => !!v);

  console.log(`Found ${pendingJobs.length} stuck PENDING send jobs.`);

  // Reset only those still sitting in APPROVED (not already SENT)
  const reset = await prisma.outreach.updateMany({
    where: { id: { in: outreachIds }, status: "APPROVED" },
    data: { status: "DRAFT_CREATED" },
  });
  console.log(`Reset ${reset.count} outreach(es) APPROVED -> DRAFT_CREATED.`);

  const del = await prisma.jobQueue.deleteMany({
    where: { id: { in: pendingJobs.map((j) => j.id) } },
  });
  console.log(`Deleted ${del.count} stale queue job(s).`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
