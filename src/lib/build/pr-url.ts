/**
 * Pull-request URL extraction, kept apart from `runner.ts` so it can be tested
 * without importing the database client — `runner.ts` pulls in `@/db`, which
 * throws at import time when DATABASE_URL is unset.
 */

const PR_URL_PATTERN =
  /https:\/\/github\.com\/[\w.-]+\/[\w.-]+\/pull\/\d+/

/**
 * Finds the first pull-request URL in an arbitrary blob of agent output.
 *
 * The agent reports the pull request it opened in prose, and the same URL also
 * turns up inside MCP tool results, so callers hand this whole serialized
 * events rather than a known field. First match wins: a run opens one pull
 * request, and later mentions are that same URL repeated.
 */
export function extractPullRequestUrl(text: string): string | null {
  return PR_URL_PATTERN.exec(text)?.[0] ?? null
}
