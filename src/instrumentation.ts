export async function register() {
  // Only start the job processor on the server (not during build or in the browser)
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startJobProcessor } = await import("@/lib/job-processor");
    startJobProcessor();
  }
}
