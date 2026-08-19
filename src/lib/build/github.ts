import { decryptSecret } from "@/lib/crypto"

/** How checks read on the work item. `unknown` means we were not allowed to look. */
export type ChecksState = "passing" | "failing" | "pending" | "none" | "unknown"
export type PullRequestState = "open" | "merged" | "closed"

export type PullRequestSnapshot = {
  state: PullRequestState
  checks: ChecksState
  headSha: string
}

/** `https://github.com/owner/repo/pull/12` → `{ path: "owner/repo", number: 12 }`. */
export function parsePullRequestUrl(url: string) {
  const match = /github\.com\/([\w.-]+\/[\w.-]+)\/pull\/(\d+)/.exec(url)
  if (!match) return null
  return { path: match[1], number: Number(match[2]) }
}

export function repoPathFromUrl(url: string) {
  return new URL(url).pathname.replace(/^\/|\/$/g, "")
}

function headers(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  }
}

/**
 * Reads the check runs for a commit.
 *
 * A fine-grained token needs an explicit "Checks: read" permission that the
 * operator may well not have granted, and the pull request's own state is far
 * more important than its checks — so a refusal degrades to `unknown` rather
 * than failing the whole sync.
 */
async function checksFor(
  repoPath: string,
  sha: string,
  token: string
): Promise<ChecksState> {
  const response = await fetch(
    `https://api.github.com/repos/${repoPath}/commits/${sha}/check-runs`,
    { headers: headers(token) }
  )
  if (!response.ok) return "unknown"

  const body = (await response.json()) as {
    check_runs?: { status: string; conclusion: string | null }[]
  }
  const runs = body.check_runs ?? []
  if (runs.length === 0) return "none"

  if (runs.some((r) => r.conclusion === "failure" || r.conclusion === "timed_out"))
    return "failing"
  if (runs.some((r) => r.status !== "completed")) return "pending"
  return "passing"
}

/** Current state of a pull request, or null if it cannot be read. */
export async function readPullRequest(
  pullRequestUrl: string,
  encryptedToken: string
): Promise<PullRequestSnapshot | null> {
  const parsed = parsePullRequestUrl(pullRequestUrl)
  if (!parsed) return null

  let token: string
  try {
    token = decryptSecret(encryptedToken)
  } catch {
    return null
  }

  const response = await fetch(
    `https://api.github.com/repos/${parsed.path}/pulls/${parsed.number}`,
    { headers: headers(token) }
  )
  if (!response.ok) return null

  const pr = (await response.json()) as {
    state: string
    merged: boolean
    head: { sha: string }
  }

  // GitHub reports a merged PR as `closed` with `merged: true`, and the
  // difference is the whole point here — merged means done, closed means
  // abandoned.
  let state: PullRequestState = "open"
  if (pr.merged) state = "merged"
  else if (pr.state === "closed") state = "closed"

  return {
    state,
    checks: await checksFor(parsed.path, pr.head.sha, token),
    headSha: pr.head.sha,
  }
}

/** The current head commit of a branch, or null if it is gone. */
export async function readBranchHead(
  repositoryUrl: string,
  branch: string,
  encryptedToken: string
) {
  let token: string
  try {
    token = decryptSecret(encryptedToken)
  } catch {
    return null
  }

  const response = await fetch(
    `https://api.github.com/repos/${repoPathFromUrl(repositoryUrl)}/branches/${encodeURIComponent(branch)}`,
    { headers: headers(token) }
  )
  if (!response.ok) return null

  const body = (await response.json()) as { commit?: { sha?: string } }
  return body.commit?.sha ?? null
}
