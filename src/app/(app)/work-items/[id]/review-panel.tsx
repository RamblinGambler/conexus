"use client"

import { ExternalLink, GitPullRequest, MessageSquarePlus } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"

import { requestChanges } from "@/app/(app)/work-items/[id]/build-actions"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"

export type ReviewRun = {
  id: string
  status: "queued" | "running" | "succeeded" | "failed"
  reviewNote: string | null
  pullRequestUrl: string | null
  prState: string | null
  prChecks: string | null
  prNumber: number | null
  createdAt: string
}

const PR_LABEL: Record<string, string> = {
  open: "Open",
  merged: "Merged",
  closed: "Closed",
}

const PR_VARIANT: Record<string, "secondary" | "outline" | "destructive"> = {
  open: "outline",
  merged: "secondary",
  closed: "destructive",
}

const CHECKS_LABEL: Record<string, string> = {
  passing: "Checks passing",
  failing: "Checks failing",
  pending: "Checks running",
  none: "No checks",
  unknown: "Checks unavailable",
}

export function ReviewPanel({
  workItemId,
  runs,
}: {
  workItemId: string
  runs: ReviewRun[]
}) {
  const router = useRouter()
  const [note, setNote] = useState("")
  const [sending, setSending] = useState(false)

  // Newest run holds the current pull request — a rebuild copies it forward.
  const latest = runs.at(-1)
  if (!latest?.pullRequestUrl) return null

  const active = latest.status === "queued" || latest.status === "running"
  const merged = latest.prState === "merged"

  async function submit() {
    setSending(true)
    const result = await requestChanges(workItemId, note)
    setSending(false)

    if ("error" in result) {
      toast.error(result.error)
      return
    }
    setNote("")
    router.refresh()
    toast.success("Queued — the same pull request will be updated")
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <GitPullRequest className="size-4" />
          Review
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <a
            href={latest.pullRequestUrl}
            target="_blank"
            rel="noreferrer"
            data-testid="review-pr-link"
            className="flex items-center gap-1.5 text-sm underline underline-offset-4"
          >
            <ExternalLink className="size-3.5" />
            {latest.prNumber ? `#${latest.prNumber}` : "Pull request"}
          </a>
          {latest.prState ? (
            <Badge
              variant={PR_VARIANT[latest.prState] ?? "outline"}
              data-testid="review-pr-state"
            >
              {PR_LABEL[latest.prState] ?? latest.prState}
            </Badge>
          ) : null}
          {latest.prChecks && latest.prChecks !== "none" ? (
            <Badge
              variant={latest.prChecks === "failing" ? "destructive" : "outline"}
              data-testid="review-pr-checks"
            >
              {CHECKS_LABEL[latest.prChecks] ?? latest.prChecks}
            </Badge>
          ) : null}
        </div>

        {/* What was asked for, next to what it produced. */}
        <ol className="flex flex-col gap-3 border-l pl-4">
          {runs.map((run, index) => (
            <li key={run.id} data-testid="review-step" className="text-sm">
              {run.reviewNote ? (
                <p className="text-foreground">
                  <span className="text-muted-foreground">You asked: </span>
                  {run.reviewNote}
                </p>
              ) : (
                <p className="text-muted-foreground">
                  Built from the spec, opening the pull request
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                {index === 0 ? "Build" : `Round ${index + 1}`} ·{" "}
                {run.status === "succeeded" && run.reviewNote
                  ? "branch updated"
                  : run.status}
              </p>
            </li>
          ))}
        </ol>

        {merged ? (
          <p
            data-testid="review-merged-note"
            className="text-sm text-muted-foreground"
          >
            Merged — this work item moved to Done on its own.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            <Textarea
              id="review-note"
              rows={3}
              value={note}
              placeholder="What should be different? The same pull request gets updated."
              onChange={(e) => setNote(e.target.value)}
              disabled={active}
            />
            <Button
              type="button"
              variant="secondary"
              data-testid="request-changes"
              onClick={submit}
              disabled={active || sending || !note.trim()}
            >
              <MessageSquarePlus className="size-4" />
              {sending ? "Queueing..." : "Build again with changes"}
            </Button>
            {active ? (
              <p className="text-xs text-muted-foreground">
                A round is already in flight.
              </p>
            ) : null}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
