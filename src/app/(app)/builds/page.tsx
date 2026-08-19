import { asc, desc, eq, inArray } from "drizzle-orm"
import Link from "next/link"
import { redirect } from "next/navigation"

import { AutoRefresh } from "@/app/(app)/builds/auto-refresh"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { db } from "@/db"
import { buildRuns } from "@/db/schema"
import { getCurrentUser } from "@/lib/session"

const WITH_DETAIL = {
  workItem: { columns: { id: true, title: true } },
  repository: { columns: { name: true } },
} as const

function relative(date: Date | null) {
  if (!date) return null
  const seconds = Math.round((Date.now() - date.getTime()) / 1000)
  if (seconds < 60) return `${Math.max(seconds, 0)}s ago`
  if (seconds < 3600) return `${Math.round(seconds / 60)}m ago`
  if (seconds < 86_400) return `${Math.round(seconds / 3600)}h ago`
  return `${Math.round(seconds / 86_400)}d ago`
}

const PR_LABEL: Record<string, string> = {
  open: "Open",
  merged: "Merged",
  closed: "Closed",
}

type Run = {
  id: string
  status: "queued" | "running" | "succeeded" | "failed"
  branchName: string | null
  pullRequestUrl: string | null
  prNumber: number | null
  prState: string | null
  prChecks: string | null
  startedAt: Date | null
  finishedAt: Date | null
  createdAt: Date
  workItem: { id: string; title: string } | null
  repository: { name: string } | null
}

function RunRow({ run, prefix }: { run: Run; prefix?: string }) {
  const stamp =
    run.status === "queued"
      ? `queued ${relative(run.createdAt)}`
      : run.status === "running"
        ? `started ${relative(run.startedAt)}`
        : relative(run.finishedAt)

  return (
    <li
      data-testid="build-row"
      data-run-id={run.id}
      data-status={run.status}
      className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b py-3 last:border-b-0"
    >
      {prefix ? (
        <span className="w-5 shrink-0 text-sm tabular-nums text-muted-foreground">
          {prefix}
        </span>
      ) : null}

      <Link
        href={`/work-items/${run.workItem?.id ?? ""}`}
        className="font-medium underline-offset-4 hover:underline"
      >
        {run.workItem?.title ?? "Deleted work item"}
      </Link>

      {run.repository ? (
        <span className="text-xs text-muted-foreground">
          {run.repository.name}
        </span>
      ) : null}

      <span className="ml-auto flex items-center gap-3">
        {run.pullRequestUrl ? (
          <a
            href={run.pullRequestUrl}
            target="_blank"
            rel="noreferrer"
            data-testid="build-row-pr"
            className="text-sm underline underline-offset-4"
          >
            {run.prNumber ? `#${run.prNumber}` : "Pull request"}
          </a>
        ) : null}
        {run.prState ? (
          <Badge
            variant={run.prState === "merged" ? "secondary" : "outline"}
            data-testid="build-row-pr-state"
          >
            {PR_LABEL[run.prState] ?? run.prState}
          </Badge>
        ) : null}
        {run.prChecks === "failing" ? (
          <Badge variant="destructive">Checks failing</Badge>
        ) : null}
        {stamp ? (
          <span className="text-xs text-muted-foreground">{stamp}</span>
        ) : null}
        {run.status === "failed" ? (
          <Badge variant="destructive">Failed</Badge>
        ) : null}
      </span>
    </li>
  )
}

function Section({
  title,
  description,
  empty,
  children,
}: {
  title: string
  description: string
  empty: string
  children: React.ReactNode[]
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        {children.length > 0 ? (
          <ul className="flex flex-col">{children}</ul>
        ) : (
          <p className="text-sm text-muted-foreground">{empty}</p>
        )}
      </CardContent>
    </Card>
  )
}

export default async function BuildsPage() {
  const user = await getCurrentUser()
  if (!user) {
    redirect("/signed-out")
  }

  const [active, queued, finished] = await Promise.all([
    db.query.buildRuns.findMany({
      where: eq(buildRuns.status, "running"),
      with: WITH_DETAIL,
      orderBy: [asc(buildRuns.startedAt)],
    }),
    db.query.buildRuns.findMany({
      where: eq(buildRuns.status, "queued"),
      with: WITH_DETAIL,
      // The order they will run in — the queue claims the oldest first.
      orderBy: [asc(buildRuns.createdAt)],
    }),
    db.query.buildRuns.findMany({
      where: inArray(buildRuns.status, ["succeeded", "failed"]),
      with: WITH_DETAIL,
      orderBy: [desc(buildRuns.finishedAt)],
      limit: 10,
    }),
  ])

  return (
    <div className="flex max-w-4xl flex-col gap-6">
      {/* Nothing to poll for once everything has settled. */}
      <AutoRefresh active={active.length > 0 || queued.length > 0} />

      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Builds</h1>
        <p className="text-muted-foreground">
          Runs continue on the server, so you can close this and come back. You
          get an email when each one finishes.
        </p>
      </div>

      <Section
        title="Running"
        description="One at a time, so a run always has the repository to itself."
        empty="Nothing is building right now."
      >
        {active.map((run) => (
          <RunRow key={run.id} run={run} />
        ))}
      </Section>

      <Section
        title="Queued"
        description="These start automatically, in this order."
        empty="Nothing is waiting."
      >
        {queued.map((run, index) => (
          <RunRow key={run.id} run={run} prefix={`${index + 1}.`} />
        ))}
      </Section>

      <Section
        title="Recently finished"
        description="The last ten runs."
        empty="No builds have finished yet."
      >
        {finished.map((run) => (
          <RunRow key={run.id} run={run} />
        ))}
      </Section>
    </div>
  )
}
