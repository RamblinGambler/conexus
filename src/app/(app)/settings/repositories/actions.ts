"use server"

import { eq } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { z } from "zod"

import { db } from "@/db"
import { repositories } from "@/db/schema"
import { encryptSecret } from "@/lib/crypto"
import { getCurrentUser } from "@/lib/session"

const repositorySchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  url: z
    .url("Enter the repository URL")
    .refine(
      (u) => /^https:\/\/github\.com\/[\w.-]+\/[\w.-]+\/?$/.test(u),
      "Use a URL like https://github.com/owner/repo"
    ),
  token: z.string().trim().min(1, "An access token is required"),
})

export type RepositoryInput = z.infer<typeof repositorySchema>

/**
 * Checks the token against GitHub before storing it.
 *
 * Without this, a bad token is only discovered minutes into a build run, as a
 * confusing "credentials not available" message from inside the agent sandbox.
 * Catching it here turns that into an immediate, specific error.
 */
async function verifyToken(token: string, url: string) {
  // A pasted `GH_TOKEN=ghp_…` line is the most common mistake, and the
  // resulting error from GitHub is unhelpful.
  if (/^[A-Za-z0-9_-]+\s*=/.test(token)) {
    return "That looks like a whole line (e.g. `GH-TOKEN=…`). Paste only the token value."
  }
  if (!/^(github_pat_|ghp_|gho_|ghs_)/.test(token)) {
    return "That doesn't look like a GitHub token — they start with `github_pat_` or `ghp_`."
  }

  const path = new URL(url).pathname.replace(/^\/|\/$/g, "")
  let response: Response
  try {
    response = await fetch(`https://api.github.com/repos/${path}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
      },
    })
  } catch {
    return "Could not reach GitHub to check the token. Check your connection and try again."
  }

  if (response.status === 401) return "GitHub rejected that token (bad credentials)."
  if (response.status === 404) {
    return "GitHub can't see that repository with this token. Check the URL, and that the token grants access to it."
  }
  if (!response.ok) return `GitHub returned ${response.status} when checking the token.`

  const repo = (await response.json()) as { permissions?: { push?: boolean } }
  if (!repo.permissions?.push) {
    return "That token can read the repository but not push to it. It needs Contents: Read and write."
  }

  return null
}

export async function addRepository(input: RepositoryInput) {
  const user = await getCurrentUser()
  if (!user) return { error: "Not signed in" }

  const parsed = repositorySchema.safeParse(input)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" }
  }

  const { name, url, token } = parsed.data
  const problem = await verifyToken(token, url)
  if (problem) return { error: problem }

  await db.insert(repositories).values({
    name,
    url: url.replace(/\/$/, ""),
    encryptedToken: encryptSecret(token),
  })

  revalidatePath("/settings/repositories")
  return { ok: true }
}

export async function removeRepository(id: string) {
  const user = await getCurrentUser()
  if (!user) return { error: "Not signed in" }

  await db.delete(repositories).where(eq(repositories.id, id))

  revalidatePath("/settings/repositories")
  return { ok: true }
}
