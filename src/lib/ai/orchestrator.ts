import { asc, desc, eq } from "drizzle-orm"
import { z } from "zod"

import { db } from "@/db"
import { changeLogEntries, users, workItems } from "@/db/schema"
import { productSection } from "@/lib/ai/prompts"
import { fieldLabel } from "@/lib/field-labels"
import { canEditAltitude, roleLabel } from "@/lib/roles"
import { getWorkspaceSettings } from "@/lib/workspace"
import type { UserRole, WorkspaceMode } from "@/db/schema"
import {
  applyPrd,
  applyRoadmap,
  applySpec,
  applyStatusChange,
  applyWorkItemCore,
} from "@/lib/work-item-writes"
import {
  PRIORITY_VALUES,
  STATUS_VALUES,
  priorityLabel,
  statusLabel,
} from "@/lib/work-items"

export type Caller = { id: string; role: UserRole; name: string | null }

/** A tool result the route streams back as a one-line note. */
export type ToolOutcome = { summary: string }

/**
 * Builds the system prompt. The agent reads from context rather than through
 * tools — one round trip, and it cannot wander outside this work item.
 */
export async function buildContext(workItemId: string, caller: Caller) {
  const item = await db.query.workItems.findFirst({
    where: eq(workItems.id, workItemId),
    with: {
      owner: { columns: { name: true, email: true } },
      roadmapEntry: true,
      prd: true,
      spec: true,
    },
  })
  if (!item) return null

  const [history, allUsers, settings] = await Promise.all([
    db.query.changeLogEntries.findMany({
      where: eq(changeLogEntries.workItemId, workItemId),
      orderBy: [desc(changeLogEntries.createdAt)],
      limit: 20,
      with: { actor: { columns: { name: true, email: true } } },
    }),
    db.query.users.findMany({
      columns: { name: true, email: true },
      orderBy: [asc(users.name)],
    }),
    getWorkspaceSettings(),
  ])

  const line = (label: string, value: string | null | undefined) =>
    value?.trim() ? `- ${label}: ${value.trim()}` : null

  const historyLines = history.length
    ? history
        .map((h) => {
          const who =
            h.actorType === "agent"
              ? `Orchestration Agent (approved by ${h.actor?.name ?? h.actor?.email ?? "someone"})`
              : (h.actor?.name ?? h.actor?.email ?? "someone")
          return `- ${fieldLabel(h.field)}: "${h.oldValue ?? "(empty)"}" -> "${h.newValue ?? "(empty)"}" by ${who}${h.why ? ` (${h.why})` : ""}`
        })
        .join("\n")
    : "- (no recorded changes yet)"

  const system = `You are the Conexus orchestration agent for one work item. You answer questions about it and change it when asked.

You are talking to ${caller.name ?? "a teammate"}, whose role is ${roleLabel(caller.role)}.
${
  productSection(settings, [
    "productName",
    "productAudience",
    "productStack",
    "productConventions",
  ]) ?? ""
}
WORK ITEM
${[
  line("Title", item.title),
  line("Summary", item.summary),
  line("Status", statusLabel(item.status)),
  line("Priority", priorityLabel(item.priority)),
  line("Owner", item.owner?.name ?? item.owner?.email ?? "Unassigned"),
]
  .filter(Boolean)
  .join("\n")}

ROADMAP (executive altitude)
${
  [
    line("Target timeframe", item.roadmapEntry?.targetTimeframe),
    line("Business goal", item.roadmapEntry?.businessGoal),
    line("Why this matters", item.roadmapEntry?.why),
  ]
    .filter(Boolean)
    .join("\n") || "- (empty)"
}

PRD (product manager altitude)
${
  [
    line("Problem statement", item.prd?.problemStatement),
    line("Goals", item.prd?.goals),
    line("In scope", item.prd?.inScope),
    line("Out of scope", item.prd?.outOfScope),
    line("Success criteria", item.prd?.successCriteria),
  ]
    .filter(Boolean)
    .join("\n") || "- (empty)"
}

SPEC (engineer and designer altitude)
${
  [
    line("Technical approach", item.spec?.technicalApproach),
    line("Design notes", item.spec?.designNotes),
    line("Acceptance criteria", item.spec?.acceptanceCriteria),
  ]
    .filter(Boolean)
    .join("\n") || "- (empty)"
}

RECENT HISTORY (newest first)
${historyLines}

PEOPLE (for assigning an owner, by email)
${allUsers.map((u) => `- ${u.name ?? u.email} <${u.email}>`).join("\n")}

RULES
- Only change something when the person clearly asks you to. Answering a question is not a request to change anything.
- After making a change, say plainly what you changed, from what to what.
- If a tool refuses because of the person's role, tell them who can make that change. Do not try another route around it.
- Keep replies short. You are in a side panel, not a document.`

  return { system, item }
}

/**
 * Tool implementations. Each one runs with the caller's own permissions — the
 * agent is acting on their behalf, so it must not be able to do anything they
 * could not do themselves.
 */
export function buildToolImpls(
  workItemId: string,
  caller: Caller,
  why: string,
  mode: WorkspaceMode
) {
  const actor = { type: "agent" as const, userId: caller.id }

  async function currentItem() {
    return db.query.workItems.findFirst({ where: eq(workItems.id, workItemId) })
  }

  function altitudeRefusal(altitude: "roadmap" | "prd" | "spec") {
    if (canEditAltitude(caller.role, altitude, mode)) return null
    return `Refused: a ${roleLabel(caller.role)} cannot edit the ${altitude} view.`
  }

  return {
    async set_status({ status }: { status: (typeof STATUS_VALUES)[number] }) {
      const item = await currentItem()
      if (!item) return "Work item not found."
      if (item.status === status) return `Already ${statusLabel(status)}.`

      const siblings = await db.query.workItems.findMany({
        where: eq(workItems.status, status),
        orderBy: [asc(workItems.position)],
      })
      await applyStatusChange(
        {
          id: workItemId,
          status,
          orderedIds: [...siblings.map((s) => s.id), workItemId],
        },
        actor,
        why
      )
      return `Status changed from ${statusLabel(item.status)} to ${statusLabel(status)}.`
    },

    async set_priority({
      priority,
    }: {
      priority: (typeof PRIORITY_VALUES)[number]
    }) {
      const item = await currentItem()
      if (!item) return "Work item not found."
      await applyWorkItemCore(
        {
          id: workItemId,
          title: item.title,
          summary: item.summary ?? "",
          priority,
          ownerId: item.ownerId ?? "",
        },
        actor,
        why
      )
      return `Priority changed from ${priorityLabel(item.priority)} to ${priorityLabel(priority)}.`
    },

    async set_owner({ email }: { email: string }) {
      const item = await currentItem()
      if (!item) return "Work item not found."

      const unassign = !email || email.toLowerCase() === "unassigned"
      const owner = unassign
        ? null
        : await db.query.users.findFirst({
            where: eq(users.email, email.toLowerCase()),
          })
      if (!unassign && !owner) return `No user found with the email ${email}.`

      await applyWorkItemCore(
        {
          id: workItemId,
          title: item.title,
          summary: item.summary ?? "",
          priority: item.priority,
          ownerId: owner?.id ?? "",
        },
        actor,
        why
      )
      return unassign
        ? "Owner cleared."
        : `Owner set to ${owner?.name ?? owner?.email}.`
    },

    async update_roadmap(input: {
      targetTimeframe?: string
      businessGoal?: string
      why?: string
    }) {
      const refusal = altitudeRefusal("roadmap")
      if (refusal) return refusal

      const current = await db.query.roadmapEntries.findFirst({
        where: (t, { eq: e }) => e(t.workItemId, workItemId),
      })
      await applyRoadmap(
        {
          workItemId,
          targetTimeframe: input.targetTimeframe ?? current?.targetTimeframe ?? "",
          businessGoal: input.businessGoal ?? current?.businessGoal ?? "",
          why: input.why ?? current?.why ?? "",
        },
        actor,
        why
      )
      return "Roadmap updated."
    },

    async update_prd(input: {
      problemStatement?: string
      goals?: string
      inScope?: string
      outOfScope?: string
      successCriteria?: string
    }) {
      const refusal = altitudeRefusal("prd")
      if (refusal) return refusal

      const current = await db.query.prds.findFirst({
        where: (t, { eq: e }) => e(t.workItemId, workItemId),
      })
      await applyPrd(
        {
          workItemId,
          problemStatement:
            input.problemStatement ?? current?.problemStatement ?? "",
          goals: input.goals ?? current?.goals ?? "",
          inScope: input.inScope ?? current?.inScope ?? "",
          outOfScope: input.outOfScope ?? current?.outOfScope ?? "",
          successCriteria: input.successCriteria ?? current?.successCriteria ?? "",
        },
        actor,
        why
      )
      return "PRD updated."
    },

    async update_spec(input: {
      technicalApproach?: string
      designNotes?: string
      acceptanceCriteria?: string
    }) {
      const refusal = altitudeRefusal("spec")
      if (refusal) return refusal

      const current = await db.query.specs.findFirst({
        where: (t, { eq: e }) => e(t.workItemId, workItemId),
      })
      await applySpec(
        {
          workItemId,
          technicalApproach:
            input.technicalApproach ?? current?.technicalApproach ?? "",
          designNotes: input.designNotes ?? current?.designNotes ?? "",
          acceptanceCriteria:
            input.acceptanceCriteria ?? current?.acceptanceCriteria ?? "",
        },
        actor,
        why
      )
      return "Spec updated."
    },
  }
}

export const TOOL_SCHEMAS = {
  set_status: z.object({ status: z.enum(STATUS_VALUES) }),
  set_priority: z.object({ priority: z.enum(PRIORITY_VALUES) }),
  set_owner: z.object({
    email: z.string().describe("The new owner's email, or 'unassigned'."),
  }),
  update_roadmap: z.object({
    targetTimeframe: z.string().optional(),
    businessGoal: z.string().optional(),
    why: z.string().optional(),
  }),
  update_prd: z.object({
    problemStatement: z.string().optional(),
    goals: z.string().optional(),
    inScope: z.string().optional(),
    outOfScope: z.string().optional(),
    successCriteria: z.string().optional(),
  }),
  update_spec: z.object({
    technicalApproach: z.string().optional(),
    designNotes: z.string().optional(),
    acceptanceCriteria: z.string().optional(),
  }),
}

export const TOOL_DESCRIPTIONS: Record<keyof typeof TOOL_SCHEMAS, string> = {
  set_status: "Move the work item to a different board column.",
  set_priority: "Change the work item's priority.",
  set_owner: "Assign the work item to someone, or unassign it.",
  update_roadmap:
    "Update the executive-altitude roadmap fields. Only fields you pass are changed.",
  update_prd:
    "Update the product-manager-altitude PRD fields. Only fields you pass are changed.",
  update_spec:
    "Update the engineer/designer-altitude spec fields. Only fields you pass are changed.",
}
