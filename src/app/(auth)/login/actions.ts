"use server"

import { AuthError } from "next-auth"

import { signIn } from "@/auth"
import { loginSchema, type LoginInput } from "@/lib/validation"

/**
 * Signs in server-side, for the same reason signup does: calling `signIn` from
 * the browser needs a CSRF-token round-trip that can race with the freshly-set
 * cookie and fail with MissingCSRF on a cold server. Doing it here sets the
 * cookie directly.
 *
 * On success this never returns — `signIn` throws a redirect.
 */
export async function logIn(input: LoginInput, callbackUrl: string) {
  const parsed = loginSchema.safeParse(input)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" }
  }

  // Only allow in-app destinations, so a crafted callbackUrl can't bounce
  // someone to another site after authenticating.
  const redirectTo = callbackUrl.startsWith("/") ? callbackUrl : "/board"

  try {
    await signIn("credentials", { ...parsed.data, redirectTo })
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: "Incorrect email or password" }
    }
    // Redirects surface as thrown errors — let them through.
    throw error
  }
}
