/**
 * Starts the build queue when the server starts.
 *
 * This is what makes a run finish with nobody watching. Before it, the queue
 * only advanced while a browser tab polled `/api/build-runs/[id]` — close the
 * tab and the run sat at `running` until someone reopened it.
 */
export async function register() {
  // `register()` also runs on the edge runtime, which has no database driver
  // and no long-lived process to hold an interval.
  if (process.env.NEXT_RUNTIME !== "nodejs") return

  const intervalMs = Number(process.env.BUILD_QUEUE_TICK_MS ?? 10_000)
  if (!Number.isFinite(intervalMs) || intervalMs <= 0) return

  const { tickBuildQueue } = await import("@/lib/build/queue")

  // Dev restarts re-run `register()` in the same process; without this the
  // intervals accumulate and every build gets synced several times over.
  const globalForQueue = globalThis as unknown as {
    conexusBuildQueueTimer?: ReturnType<typeof setInterval>
  }
  clearInterval(globalForQueue.conexusBuildQueueTimer)

  const timer = setInterval(() => {
    void tickBuildQueue()
  }, intervalMs)
  // Don't hold the process open on shutdown just because the queue is idle.
  timer.unref?.()

  globalForQueue.conexusBuildQueueTimer = timer
  console.log(`[build-queue] ticking every ${intervalMs}ms`)
}
