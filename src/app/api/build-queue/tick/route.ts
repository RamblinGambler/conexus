import { tickBuildQueue } from "@/lib/build/queue"

/**
 * Drives the build queue from an external scheduler.
 *
 * The in-process ticker in `src/instrumentation.ts` covers a long-lived
 * server. This covers serverless, where nothing survives between requests and
 * a cron is the only thing that can advance a run.
 */
export async function POST(request: Request) {
  const secret = process.env.BUILD_QUEUE_SECRET

  // Closed unless deliberately configured. Anyone who can reach this endpoint
  // can start builds, so an unset secret disables it rather than opening it.
  if (!secret) {
    return Response.json(
      { error: "BUILD_QUEUE_SECRET is not set — this endpoint is disabled" },
      { status: 503 }
    )
  }

  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  await tickBuildQueue()
  return Response.json({ ok: true })
}
