import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  jobProcessSendQueue,
  jobCheckReplies,
  jobProcessFollowUps,
  jobRunWarmupAgent,
} from "@/lib/job-processor";

const VALID_JOBS = [
  "send_queue",
  "check_replies",
  "follow_ups",
  "warmup",
] as const;

type JobName = (typeof VALID_JOBS)[number];

const JOB_HANDLERS: Record<JobName, () => Promise<void>> = {
  send_queue: jobProcessSendQueue,
  check_replies: jobCheckReplies,
  follow_ups: jobProcessFollowUps,
  warmup: jobRunWarmupAgent,
};

/**
 * GET /api/cron?job=send_queue
 *
 * Manual trigger endpoint for background jobs.
 * Requires authentication — only logged-in users can trigger jobs.
 */
export async function GET(request: NextRequest) {
  // Authenticate the request
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Parse the job parameter
  const { searchParams } = new URL(request.url);
  const jobName = searchParams.get("job") as JobName | null;

  if (!jobName || !VALID_JOBS.includes(jobName)) {
    return NextResponse.json(
      {
        error: `Invalid job name. Valid jobs: ${VALID_JOBS.join(", ")}`,
      },
      { status: 400 },
    );
  }

  const handler = JOB_HANDLERS[jobName];
  const startTime = Date.now();

  try {
    await handler();

    const durationMs = Date.now() - startTime;

    return NextResponse.json({
      success: true,
      job: jobName,
      durationMs,
      triggeredBy: session.user.email ?? session.user.id,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const durationMs = Date.now() - startTime;

    console.error(`[cron-api] Job ${jobName} failed:`, message);

    return NextResponse.json(
      {
        success: false,
        job: jobName,
        error: message,
        durationMs,
        timestamp: new Date().toISOString(),
      },
      { status: 500 },
    );
  }
}
