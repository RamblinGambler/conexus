"use client"

import { useRouter } from "next/navigation"
import { useEffect } from "react"

/**
 * Keeps the builds page current while anything is in flight.
 *
 * `router.refresh()` re-runs the page's own server queries, so the queue has
 * exactly one source of truth rather than a second polling endpoint that could
 * disagree with it.
 */
export function AutoRefresh({
  active,
  intervalMs = 4000,
}: {
  active: boolean
  intervalMs?: number
}) {
  const router = useRouter()

  useEffect(() => {
    if (!active) return
    const timer = setInterval(() => router.refresh(), intervalMs)
    return () => clearInterval(timer)
  }, [active, intervalMs, router])

  return null
}
