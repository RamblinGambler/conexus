import { eq } from "drizzle-orm"

import { db } from "@/db"
import { repositories } from "@/db/schema"
import { draftProductBrief } from "@/lib/ai/authoring"
import { decryptSecret } from "@/lib/crypto"

/**
 * Files that describe a project to a newcomer. Reading these is enough for a
 * first draft the operator will edit — cheap and quick, where sending a coding
 * agent to explore the repository would take minutes and cost a full sandbox
 * session for something that gets rewritten anyway.
 */
const CANDIDATE_FILES = [
  "README.md",
  "package.json",
  "AGENTS.md",
  "CONTRIBUTING.md",
  "CLAUDE.md",
]

/** Truncated so one enormous README can't dominate the prompt. */
const MAX_CHARS_PER_FILE = 12_000

async function fetchFile(repoPath: string, path: string, token: string) {
  const response = await fetch(
    `https://api.github.com/repos/${repoPath}/contents/${path}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github.raw+json",
      },
    }
  )

  // A missing file is the normal case, not a failure — most repositories have
  // only some of these.
  if (!response.ok) return null

  const content = await response.text()
  return content.trim() ? content.slice(0, MAX_CHARS_PER_FILE) : null
}

export async function draftBriefFromRepository(repositoryId: string) {
  const repository = await db.query.repositories.findFirst({
    where: eq(repositories.id, repositoryId),
  })
  if (!repository) return { error: "Repository not found" as const }

  let token: string
  try {
    token = decryptSecret(repository.encryptedToken)
  } catch {
    return { error: "Could not read that repository's access token" as const }
  }

  const repoPath = new URL(repository.url).pathname.replace(/^\/|\/$/g, "")

  const fetched = await Promise.all(
    CANDIDATE_FILES.map(async (path) => {
      const content = await fetchFile(repoPath, path, token).catch(() => null)
      return content ? { path, content } : null
    })
  )
  const files = fetched.filter((f) => f !== null)

  if (files.length === 0) {
    return {
      error:
        "Couldn't read anything from that repository — check the token still has access." as const,
    }
  }

  return { ok: true as const, draft: await draftProductBrief(files) }
}
