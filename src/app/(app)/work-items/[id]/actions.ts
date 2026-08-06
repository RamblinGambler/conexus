"use server"

import { eq } from "drizzle-orm"
import { revalidatePath } from "next/cache"

import { db } from "@/db"
import { workItems } from "@/db/schema"
import {
  generateDesignNotesDraft,
  generateSpecDraft,
  nextInterviewTurn,
  synthesizePrdDraft,
  synthesizeRoadmapDraft,
} from "@/lib/ai/authoring"
import type { WorkItemContext } from "@/lib/ai/prompts"
import type { InterviewMessage } from "@/lib/ai/schemas"
import { canEditAltitude, rolesForAltitude, type Altitude } from "@/lib/roles"
import { getCurrentUser } from "@/lib/session"
import { getWorkspaceMode, getWorkspaceSettings } from "@/lib/workspace"
import {
  applyPrd,
  applyRoadmap,
  applySpec,
  applyWorkItemCore,
} from "@/lib/work-item-writes"
import {
  prdSchema,
  roadmapSchema,
  specSchema,
  updateWorkItemCoreSchema,
  type PrdInput,
  type SpecInput,
  type RoadmapInput,
  type UpdateWorkItemCoreInput,
} from "@/lib/validation"

type CurrentUser = NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>

/** Tagged so `!access.ok` narrows cleanly at every call site. */
type AltitudeAccess =
  | { ok: false; error: string }
  | { ok: true; user: CurrentUser }

/**
 * The UI disables inputs the caller may not edit, but that is only a hint —
 * the altitude gate has to hold here, where the write actually happens.
 */
async function requireAltitudeAccess(
  altitude: Altitude
): Promise<AltitudeAccess> {
  const user = await getCurrentUser()
  if (!user) return { ok: false, error: "Not signed in" }

  // Read the mode here rather than accepting it from the caller — this is the
  // write gate, and the client must not be able to influence it.
  const mode = await getWorkspaceMode()
  if (!canEditAltitude(user.role, altitude, mode)) {
    const allowed = rolesForAltitude(altitude)
      .map((r) => `${r.label}s`)
      .join(" and ")
    return { ok: false, error: `Only ${allowed} can edit this view` }
  }

  return { ok: true, user }
}

export async function updateWorkItemCore(input: UpdateWorkItemCoreInput) {
  const user = await getCurrentUser()
  if (!user) return { error: "Not signed in" }

  const parsed = updateWorkItemCoreSchema.safeParse(input)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" }
  }

  const result = await applyWorkItemCore(parsed.data, {
    type: "user",
    userId: user.id,
  })
  if ("error" in result) return result

  revalidatePath(`/work-items/${parsed.data.id}`)
  revalidatePath("/board")
  return { ok: true }
}

export async function updateRoadmap(input: RoadmapInput) {
  const access = await requireAltitudeAccess("roadmap")
  if (!access.ok) return { error: access.error }

  const parsed = roadmapSchema.safeParse(input)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" }
  }

  await applyRoadmap(parsed.data, { type: "user", userId: access.user.id })
  revalidatePath(`/work-items/${parsed.data.workItemId}`)
  return { ok: true }
}

export async function updatePrd(input: PrdInput) {
  const access = await requireAltitudeAccess("prd")
  if (!access.ok) return { error: access.error }

  const parsed = prdSchema.safeParse(input)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" }
  }

  await applyPrd(parsed.data, { type: "user", userId: access.user.id })
  revalidatePath(`/work-items/${parsed.data.workItemId}`)
  return { ok: true }
}

export async function updateSpec(input: SpecInput) {
  const access = await requireAltitudeAccess("spec")
  if (!access.ok) return { error: access.error }

  const parsed = specSchema.safeParse(input)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" }
  }

  await applySpec(parsed.data, { type: "user", userId: access.user.id })
  revalidatePath(`/work-items/${parsed.data.workItemId}`)
  return { ok: true }
}

/**
 * Applies content that the agent drafted and the user approved, so history can
 * distinguish it from something a person typed.
 *
 * This trusts the caller's claim that the content came from generation — a user
 * could call it directly to mislabel their own edit as agent-written. That is
 * an attribution wrinkle, not an escalation: the same altitude gate applies.
 */
export async function applyGeneratedDraft(
  altitude: Altitude,
  input: RoadmapInput | PrdInput | SpecInput
) {
  const access = await requireAltitudeAccess(altitude)
  if (!access.ok) return { error: access.error }

  const actor = { type: "agent" as const, userId: access.user.id }
  const why = "Generated draft, approved by the user"

  if (altitude === "roadmap") {
    const parsed = roadmapSchema.safeParse(input)
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Invalid input" }
    }
    await applyRoadmap(parsed.data, actor, why)
    revalidatePath(`/work-items/${parsed.data.workItemId}`)
    return { ok: true }
  }

  if (altitude === "prd") {
    const parsed = prdSchema.safeParse(input)
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Invalid input" }
    }
    await applyPrd(parsed.data, actor, why)
    revalidatePath(`/work-items/${parsed.data.workItemId}`)
    return { ok: true }
  }

  const parsed = specSchema.safeParse(input)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" }
  }
  await applySpec(parsed.data, actor, why)
  revalidatePath(`/work-items/${parsed.data.workItemId}`)
  return { ok: true }
}

/**
 * Loads the work item plus its authored altitudes as generation context.
 * Returns null when the item does not exist.
 */
async function loadContext(workItemId: string): Promise<WorkItemContext | null> {
  const [item, settings] = await Promise.all([
    db.query.workItems.findFirst({
      where: eq(workItems.id, workItemId),
      with: { roadmapEntry: true, prd: true },
    }),
    getWorkspaceSettings(),
  ])
  if (!item) return null

  return {
    product: settings,
    title: item.title,
    summary: item.summary,
    roadmap: item.roadmapEntry ?? null,
    prd: item.prd ?? null,
  }
}

/**
 * The generation actions below deliberately do not write. They return a draft
 * for the user to accept or discard; accepting goes through applyGeneratedDraft
 * above, so there stays exactly one validated, gated write path.
 */

export async function continueInterview(
  workItemId: string,
  transcript: InterviewMessage[]
) {
  const access = await requireAltitudeAccess("prd")
  if (!access.ok) return { error: access.error }

  const ctx = await loadContext(workItemId)
  if (!ctx) return { error: "Work item not found" }

  try {
    return { ok: true as const, turn: await nextInterviewTurn(ctx, transcript) }
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Generation failed" }
  }
}

export async function synthesizeRoadmap(
  workItemId: string,
  transcript: InterviewMessage[]
) {
  const access = await requireAltitudeAccess("roadmap")
  if (!access.ok) return { error: access.error }

  const ctx = await loadContext(workItemId)
  if (!ctx) return { error: "Work item not found" }

  try {
    return {
      ok: true as const,
      draft: await synthesizeRoadmapDraft(ctx, transcript),
    }
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Generation failed" }
  }
}

export async function synthesizePrd(
  workItemId: string,
  transcript: InterviewMessage[]
) {
  const access = await requireAltitudeAccess("prd")
  if (!access.ok) return { error: access.error }

  const ctx = await loadContext(workItemId)
  if (!ctx) return { error: "Work item not found" }

  try {
    return { ok: true as const, draft: await synthesizePrdDraft(ctx, transcript) }
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Generation failed" }
  }
}

export async function generateSpec(workItemId: string) {
  const access = await requireAltitudeAccess("spec")
  if (!access.ok) return { error: access.error }

  const ctx = await loadContext(workItemId)
  if (!ctx) return { error: "Work item not found" }

  try {
    return { ok: true as const, draft: await generateSpecDraft(ctx) }
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Generation failed" }
  }
}

export async function generateDesignNotes(workItemId: string) {
  const access = await requireAltitudeAccess("spec")
  if (!access.ok) return { error: access.error }

  const ctx = await loadContext(workItemId)
  if (!ctx) return { error: "Work item not found" }

  try {
    return { ok: true as const, draft: await generateDesignNotesDraft(ctx) }
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Generation failed" }
  }
}
