"use client"

import { ExternalLink, Hammer, Loader2 } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"

import { startBuildRun } from "@/app/(app)/work-items/[id]/build-actions"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { linkRepository } from "@/app/(app)/work-items/[id]/build-actions"

export type BuildRunView = {
  id: string
  status: "queued" | "running" | "succeeded" | "failed"
  branchName: string | null
  pullRequestUrl: string | null
  outputSummary: string | null
}

export type RepositoryOption = { id: string; name: string }

const NONE = "none"

const STATUS_VARIANT = {
  queued: "outline",
  running: "secondary",
  succeeded: "secondary",
  failed: "destructive",
} as const

const STATUS_LABEL = {
  queued: "Queued",
  running: "Running",
  succeeded: "Succeeded",
  failed: "Failed",
} as const

export function BuildPanel({
  workItemId,
  repositoryId,
  repositories,
  hasSpec,
  latestRun,
}: {
  workItemId: string
  repositoryId: string | null
  repositories: RepositoryOption[]
  hasSpec: boolean
  latestRun: BuildRunView | null
}) {
  const router = useRouter()
  const [run, setRun] = useState(latestRun)
  const [starting, setStarting] = useState(false)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const active = run?.status === "queued" || run?.status === "running"

  // Poll while a run is in flight; the route advances it and, on success,
  // moves the work item to In Review.
  useEffect(() => {
    if (!run || !active) return

    const tick = async () => {
      const response = await fetch(`/api/build-runs/${run.id}`)
      if (!response.ok) return
      const { run: next } = await response.json()
      setRun(next)
      if (next.status === "succeeded" || next.status === "failed") {
        router.refresh()
      }
    }

    pollRef.current = setInterval(tick, 2000)
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [run, active, router])

  const blockedReason = !hasSpec
    ? "Write a spec before starting a build"
    : !repositoryId
      ? "Link a repository before starting a build"
      : active
        ? "A build is already queued for this item"
        : null

  async function start() {
    setStarting(true)
    const result = await startBuildRun(workItemId)
    setStarting(false)

    if ("error" in result) {
      toast.error(result.error)
      return
    }
    setRun({
      id: result.runId,
      status: "queued",
      branchName: null,
      pullRequestUrl: null,
      outputSummary: null,
    })
    router.refresh()
  }

  async function onLink(value: string) {
    const result = await linkRepository(workItemId, value === NONE ? null : value)
    if (result?.error) {
      toast.error(result.error)
      return
    }
    router.refresh()
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Build</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">Repository</span>
          <Select value={repositoryId ?? NONE} onValueChange={onLink}>
            <SelectTrigger id="build-repository" className="w-full">
              <SelectValue placeholder="Not linked" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>Not linked</SelectItem>
              {repositories.map((repo) => (
                <SelectItem key={repo.id} value={repo.id}>
                  {repo.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-2">
          <Button
            type="button"
            data-testid="build-this"
            onClick={start}
            disabled={Boolean(blockedReason) || starting}
          >
            {active ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Hammer className="size-4" />
            )}
            {starting ? "Starting..." : "Build this"}
          </Button>
          {blockedReason ? (
            <p
              data-testid="build-blocked-reason"
              className="text-xs text-muted-foreground"
            >
              {blockedReason}
            </p>
          ) : null}
        </div>

        {run ? (
          <div className="flex flex-col gap-2 rounded-lg border p-3">
            <div className="flex items-center gap-2">
              <Badge
                variant={STATUS_VARIANT[run.status]}
                data-testid="build-status"
              >
                {STATUS_LABEL[run.status]}
              </Badge>
              {run.branchName ? (
                <span className="truncate text-xs text-muted-foreground">
                  {run.branchName}
                </span>
              ) : null}
            </div>

            {active ? (
              <p
                data-testid="build-unattended-hint"
                className="text-xs text-muted-foreground"
              >
                {run.status === "queued"
                  ? "Waiting its turn. "
                  : "Running on the server. "}
                You can close this — we&apos;ll email you when it finishes.{" "}
                <Link href="/builds" className="underline underline-offset-4">
                  All builds
                </Link>
              </p>
            ) : null}

            {run.pullRequestUrl ? (
              <a
                href={run.pullRequestUrl}
                target="_blank"
                rel="noreferrer"
                data-testid="build-pr-link"
                className="flex w-fit items-center gap-1.5 text-sm underline underline-offset-4"
              >
                <ExternalLink className="size-3.5" />
                View pull request
              </a>
            ) : null}

            {run.outputSummary ? (
              <p
                data-testid="build-summary"
                className="whitespace-pre-wrap text-xs text-muted-foreground"
              >
                {run.outputSummary}
              </p>
            ) : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}
