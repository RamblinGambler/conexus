"use server"

import { revalidatePath } from "next/cache"

import type { WorkspaceMode } from "@/db/schema"
import { getCurrentUser } from "@/lib/session"
import { draftBriefFromRepository } from "@/lib/product-brief"
import {
  setDefaultRepository,
  setProductBrief,
  setWorkspaceMode,
} from "@/lib/workspace"
import {
  productBriefSchema,
  type ProductBriefInput,
} from "@/lib/validation"

export async function updateWorkspaceMode(mode: WorkspaceMode) {
  const user = await getCurrentUser()
  if (!user) return { error: "Not signed in" }

  await setWorkspaceMode(mode)

  // Mode changes who may edit what, so anything showing altitude fields or the
  // role badge has to be re-rendered.
  revalidatePath("/", "layout")
  return { ok: true }
}

export async function updateDefaultRepository(repositoryId: string | null) {
  const user = await getCurrentUser()
  if (!user) return { error: "Not signed in" }

  await setDefaultRepository(repositoryId)
  revalidatePath("/settings")
  return { ok: true }
}

export async function updateProductBrief(input: ProductBriefInput) {
  const user = await getCurrentUser()
  if (!user) return { error: "Not signed in" }

  const parsed = productBriefSchema.safeParse(input)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" }
  }

  await setProductBrief(parsed.data)

  // The brief feeds every generation, so anything cached that renders from it
  // has to be rebuilt.
  revalidatePath("/", "layout")
  return { ok: true }
}

/** Returns a draft for the operator to edit. Deliberately does not save. */
export async function draftProductBriefFromRepository(repositoryId: string) {
  const user = await getCurrentUser()
  if (!user) return { error: "Not signed in" }

  try {
    return await draftBriefFromRepository(repositoryId)
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Could not draft the brief",
    }
  }
}
