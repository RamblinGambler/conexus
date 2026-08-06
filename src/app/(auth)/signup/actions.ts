"use server"

import { eq } from "drizzle-orm"

import { signIn } from "@/auth"
import { db } from "@/db"
import { users } from "@/db/schema"
import { hashPassword } from "@/lib/password"
import { SOLO_DEFAULT_ROLE } from "@/lib/roles"
import { signupSchema, type SignupInput } from "@/lib/validation"
import {
  getWorkspaceMode,
  isFirstRun,
  setWorkspaceMode,
} from "@/lib/workspace"

/**
 * Creates the account and signs the user in server-side. Signing in here rather
 * than from the client avoids the browser's CSRF token round-trip, which could
 * race with the freshly-set cookie and fail with MissingCSRF.
 *
 * On success this never returns — `signIn` throws a redirect to `redirectTo`.
 */
export async function signUp(input: SignupInput) {
  const parsed = signupSchema.safeParse(input)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" }
  }

  const { name, email, password, role, mode } = parsed.data
  const normalizedEmail = email.toLowerCase()

  const existing = await db.query.users.findFirst({
    where: eq(users.email, normalizedEmail),
  })
  if (existing) {
    return { error: "An account with that email already exists" }
  }

  // The first account also decides how the workspace runs. Checked server-side
  // so a later signup can't reset the mode by posting one.
  const firstRun = await isFirstRun()
  if (firstRun && mode) {
    await setWorkspaceMode(mode)
  }

  const workspaceMode = await getWorkspaceMode()

  // Solo mode never asks for a role, so resolve one here. It is stored rather
  // than dropped, which is what lets a workspace switch back to team mode.
  let resolvedRole = role
  if (workspaceMode === "solo") {
    resolvedRole = SOLO_DEFAULT_ROLE
  } else if (!resolvedRole) {
    return { error: "Select a role" }
  }

  await db.insert(users).values({
    name,
    email: normalizedEmail,
    passwordHash: await hashPassword(password),
    role: resolvedRole,
  })

  await signIn("credentials", {
    email: normalizedEmail,
    password,
    redirectTo: "/board",
  })
}
