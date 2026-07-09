import { NextRequest, NextResponse } from "next/server";
import {
  jobProcessSendQueue,
  jobCheckReplies,
  jobProcessFollowUps,
} from "@/lib/job-processor";
import { ingestDeals } from "@/lib/deal-ingest";

// Vercel-compatible background tick. node-cron doesn't run on serverless, so a
// scheduler (Vercel Cron via vercel.json, or an external pinger like
// cron-job.org) hits this endpoint. Every job is idempotent and only acts on
// due work, so it is safe to call at any frequency.
export const maxDuration = 60;

function authorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false; // fail closed if unset
  const header = request.headers.get("authorization");
  if (header === `Bearer ${secret}`) return true; // Vercel Cron sends this
  if (request.nextUrl.searchParams.get("key") === secret) return true; // external pinger
  return false;
}

async function run(
  job: string,
  fn: () => Promise<unknown>,
): Promise<{ job: string; ok: boolean; error?: string }> {
  try {
    await fn();
    return { job, ok: true };
  } catch (err) {
    return { job, ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

async function handle(request: NextRequest) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Sequential to stay within the serverless time/memory budget.
  const results = [
    await run("sendQueue", jobProcessSendQueue),
    await run("followUps", jobProcessFollowUps),
    await run("replies", jobCheckReplies),
    await run("ingestDeals", () => ingestDeals(100)),
  ];

  return NextResponse.json({ ranAt: new Date().toISOString(), results });
}

// Vercel Cron issues GET; external pingers can use GET or POST.
export const GET = handle;
export const POST = handle;
