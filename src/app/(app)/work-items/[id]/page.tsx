import { asc, desc, eq } from "drizzle-orm"
import { notFound, redirect } from "next/navigation"
import { z } from "zod"

import { WorkItemDetail } from "@/app/(app)/work-items/[id]/work-item-detail"
import { db } from "@/db"
import {
  buildRuns,
  changeLogEntries,
  chatMessages,
  repositories,
  users,
  workItems,
} from "@/db/schema"
import { ALTITUDE_BY_ROLE } from "@/lib/roles"
import { getCurrentUser } from "@/lib/session"
import { getWorkspaceMode } from "@/lib/workspace"

/** The viewer's own turns read as "You"; everyone else is named. */
function chatAuthor(
  message: {
    role: "user" | "assistant"
    userId: string | null
    user: { name: string | null; email: string } | null
  },
  viewerId: string
) {
  if (message.role === "assistant") return "Orchestration Agent"
  if (message.userId === viewerId) return "You"
  return message.user?.name ?? message.user?.email ?? "Someone"
}

export default async function WorkItemPage({
  params,
}: PageProps<"/work-items/[id]">) {
  const { id } = await params
  if (!z.uuid().safeParse(id).success) {
    notFound()
  }

  const user = await getCurrentUser()
  if (!user) {
    redirect("/signed-out")
  }

  const mode = await getWorkspaceMode()

  const [item, allUsers, chat, history, repos, runs] = await Promise.all([
    db.query.workItems.findFirst({
      where: eq(workItems.id, id),
      with: {
        owner: {
          columns: { id: true, name: true, email: true, image: true },
        },
        roadmapEntry: true,
        prd: true,
        spec: true,
      },
    }),
    db.query.users.findMany({
      columns: { id: true, name: true, email: true, image: true },
      orderBy: [asc(users.name)],
    }),
    db.query.chatMessages.findMany({
      where: eq(chatMessages.workItemId, id),
      orderBy: [asc(chatMessages.createdAt)],
      with: { user: { columns: { name: true, email: true } } },
    }),
    db.query.changeLogEntries.findMany({
      where: eq(changeLogEntries.workItemId, id),
      orderBy: [desc(changeLogEntries.createdAt)],
      with: { actor: { columns: { name: true, email: true } } },
    }),
    db.query.repositories.findMany({
      columns: { id: true, name: true },
      orderBy: [asc(repositories.name)],
    }),
    // All runs, oldest first: the review timeline is the chain of rounds, and
    // the newest one carries the current pull request.
    db.query.buildRuns.findMany({
      where: eq(buildRuns.workItemId, id),
      orderBy: [asc(buildRuns.createdAt)],
    }),
  ])

  if (!item) {
    notFound()
  }

  return (
    <WorkItemDetail
      item={item}
      users={allUsers}
      role={user.role}
      defaultAltitude={ALTITUDE_BY_ROLE[user.role]}
      chat={chat.map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        author: chatAuthor(m, user.id),
      }))}
      history={history.map((h) => ({
        id: h.id,
        field: h.field,
        oldValue: h.oldValue,
        newValue: h.newValue,
        actorType: h.actorType,
        actorName: h.actor?.name ?? h.actor?.email ?? null,
        why: h.why,
        createdAt: h.createdAt,
      }))}
      mode={mode}
      repositories={repos}
      latestRun={
        runs.length > 0
          ? {
              id: runs[runs.length - 1].id,
              status: runs[runs.length - 1].status,
              branchName: runs[runs.length - 1].branchName,
              pullRequestUrl: runs[runs.length - 1].pullRequestUrl,
              outputSummary: runs[runs.length - 1].outputSummary,
            }
          : null
      }
      runs={runs.map((run) => ({
        id: run.id,
        status: run.status,
        reviewNote: run.reviewNote,
        pullRequestUrl: run.pullRequestUrl,
        prState: run.prState,
        prChecks: run.prChecks,
        prNumber: run.prNumber,
        createdAt: run.createdAt.toISOString(),
      }))}
    />
  )
}
