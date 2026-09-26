import Anthropic from "@anthropic-ai/sdk"
import { eq } from "drizzle-orm"

import { db } from "@/db"
import { repositories } from "@/db/schema"
import { productSection, type ProductBrief } from "@/lib/ai/prompts"
import { GITHUB_MCP_URL } from "@/lib/build/agent-config"
import { extractPullRequestUrl } from "@/lib/build/pr-url"
import { decryptSecret } from "@/lib/crypto"

export type BuildContext = {
  product: ProductBrief | null
  workItemTitle: string
  workItemSummary: string | null
  spec: {
    technicalApproach: string | null
    designNotes: string | null
    acceptanceCriteria: string | null
  } | null
  prd: {
    problemStatement: string | null
    goals: string | null
    inScope: string | null
    outOfScope: string | null
    successCriteria: string | null
  } | null
  repository: { id: string; name: string; url: string; encryptedToken: string; vaultId: string | null }
  branchName: string
}

/** A follow-up round on a pull request that already exists. */
export type ReviewContext = BuildContext & {
  /** What the operator wants different this time. */
  reviewNote: string
  /** The session that opened the pull request, if it is still around. */
  parentSessionId: string | null
  pullRequestUrl: string | null
}

export type BuildSync = {
  status: "queued" | "running" | "succeeded" | "failed"
  pullRequestUrl: string | null
  outputSummary: string | null
}

export const buildIsStubbed = !process.env.ANTHROPIC_API_KEY

function briefFor(ctx: BuildContext) {
  const line = (label: string, value: string | null | undefined) =>
    value?.trim() ? `${label}: ${value.trim()}` : null

  const product = productSection(ctx.product, [
    "productName",
    "productStack",
    "productConventions",
  ])

  return [
    `Implement this work item in the checked-out repository, then open a pull request.`,
    ``,
    ...(product ? [product, ``] : []),
    line("Title", ctx.workItemTitle),
    line("Summary", ctx.workItemSummary),
    ``,
    `PRODUCT REQUIREMENTS`,
    line("Problem", ctx.prd?.problemStatement),
    line("Goals", ctx.prd?.goals),
    line("In scope", ctx.prd?.inScope),
    line("Out of scope", ctx.prd?.outOfScope),
    line("Success criteria", ctx.prd?.successCriteria),
    ``,
    `SPECIFICATION`,
    line("Technical approach", ctx.spec?.technicalApproach),
    line("Design notes", ctx.spec?.designNotes),
    line("Acceptance criteria", ctx.spec?.acceptanceCriteria),
    ``,
    `Use the branch name "${ctx.branchName}".`,
  ]
    .filter((l) => l !== null)
    .join("\n")
}

/**
 * Ensures the repository has an Anthropic vault holding its GitHub credential.
 *
 * The credential is what lets the agent open a pull request: the repo mount
 * gives it git access, but the GitHub MCP server needs its own auth. The token
 * itself never enters the sandbox — Anthropic substitutes it at egress.
 */
async function ensureVault(
  client: Anthropic,
  repository: BuildContext["repository"]
) {
  if (repository.vaultId) return repository.vaultId

  const vault = await client.beta.vaults.create({
    display_name: `conexus-${repository.name}`.slice(0, 64),
  })

  await client.beta.vaults.credentials.create(vault.id, {
    display_name: `GitHub MCP for ${repository.name}`,
    auth: {
      type: "static_bearer",
      mcp_server_url: GITHUB_MCP_URL,
      token: decryptSecret(repository.encryptedToken),
    },
  })

  await db
    .update(repositories)
    .set({ vaultId: vault.id })
    .where(eq(repositories.id, repository.id))

  return vault.id
}

/** Throws unless the Managed Agents build agent is configured. */
function requireAgentConfig() {
  const agentId = process.env.ANTHROPIC_BUILD_AGENT_ID
  const environmentId = process.env.ANTHROPIC_BUILD_ENVIRONMENT_ID
  if (!agentId || !environmentId) {
    throw new Error(
      "ANTHROPIC_BUILD_AGENT_ID and ANTHROPIC_BUILD_ENVIRONMENT_ID are not set — run scripts/setup-build-agent.ts"
    )
  }
  return { agentId, environmentId }
}

/** True when there are no credentials and the caller should stub instead. */
function stubbedOut(label: string) {
  if (!buildIsStubbed) return false
  if (process.env.NODE_ENV === "production") {
    throw new Error("ANTHROPIC_API_KEY is not set")
  }
  console.warn(`[build] ANTHROPIC_API_KEY not set — running a stub ${label}`)
  return true
}

/** Starts a build. Returns the Managed Agents session id, or null when stubbed. */
export async function startBuild(ctx: BuildContext): Promise<string | null> {
  if (stubbedOut("build")) return null

  const { agentId, environmentId } = requireAgentConfig()
  const client = new Anthropic()
  const vaultId = await ensureVault(client, ctx.repository)

  const session = await client.beta.sessions.create({
    agent: agentId,
    environment_id: environmentId,
    title: ctx.workItemTitle.slice(0, 120),
    vault_ids: [vaultId],
    resources: [
      {
        type: "github_repository",
        url: ctx.repository.url,
        authorization_token: decryptSecret(ctx.repository.encryptedToken),
      },
    ],
    initial_events: [
      {
        type: "user.message",
        content: [{ type: "text", text: briefFor(ctx) }],
      },
    ],
  })

  return session.id
}

/** What to tell the agent when the operator wants the pull request changed. */
function followUpBrief(ctx: ReviewContext, fresh: boolean) {
  const lines = [
    fresh
      ? `You previously implemented this work item on the branch "${ctx.branchName}", which is checked out and already has an open pull request. Make the change described below and push to the same branch — do not open a new pull request or start a new branch.`
      : `Follow-up on the same work. Make the change described below, then push to "${ctx.branchName}" so the existing pull request updates. Do not open a new pull request.`,
    ``,
    `WHAT TO CHANGE`,
    ctx.reviewNote,
  ]

  // A fresh session has none of the original context, so it needs the brief
  // again. A resumed one already has all of it in its own transcript.
  if (fresh) {
    lines.push(``, `--- original brief, for reference ---`, ``, briefFor(ctx))
  }
  return lines.join("\n")
}

/**
 * Sends the operator's change request to the agent that built the pull request.
 *
 * Resuming keeps everything the agent already knows about the branch, and
 * sessions stay idle for days, so this is the usual path. When the session is
 * gone or already terminated, a fresh one is started with the repository
 * mounted **on the pull request's branch** — which is what keeps the change on
 * the same pull request either way.
 */
export async function resumeBuild(ctx: ReviewContext): Promise<string | null> {
  if (stubbedOut("rebuild")) return null

  const client = new Anthropic()

  if (ctx.parentSessionId) {
    const session = await client.beta.sessions
      .retrieve(ctx.parentSessionId)
      .catch(() => null)

    if (session && (session.status === "idle" || session.status === "running")) {
      await client.beta.sessions.events.send(ctx.parentSessionId, {
        events: [
          {
            type: "user.message",
            content: [{ type: "text", text: followUpBrief(ctx, false) }],
          },
        ],
      })
      return ctx.parentSessionId
    }
  }

  const { agentId, environmentId } = requireAgentConfig()
  const vaultId = await ensureVault(client, ctx.repository)

  const session = await client.beta.sessions.create({
    agent: agentId,
    environment_id: environmentId,
    title: `${ctx.workItemTitle} (changes)`.slice(0, 120),
    vault_ids: [vaultId],
    resources: [
      {
        type: "github_repository",
        url: ctx.repository.url,
        authorization_token: decryptSecret(ctx.repository.encryptedToken),
        checkout: { type: "branch", name: ctx.branchName },
      },
    ],
    initial_events: [
      {
        type: "user.message",
        content: [{ type: "text", text: followUpBrief(ctx, true) }],
      },
    ],
  })

  return session.id
}

/** Reads current state for a run. `sessionId` is null for stub runs. */
export async function syncBuild(sessionId: string | null): Promise<BuildSync> {
  if (!sessionId) {
    throw new Error("syncBuild requires a session id")
  }

  const client = new Anthropic()
  const session = await client.beta.sessions.retrieve(sessionId)

  // Scan every event for a PR URL rather than trusting one message shape —
  // it can arrive in the agent's text or in an MCP tool result.
  let pullRequestUrl: string | null = null
  const messages: string[] = []

  for await (const event of client.beta.sessions.events.list(sessionId)) {
    const text = JSON.stringify(event)
    const match = extractPullRequestUrl(text)
    if (match && !pullRequestUrl) pullRequestUrl = match

    if (event.type === "agent.message") {
      const blocks = (event as { content?: { type: string; text?: string }[] })
        .content
      for (const block of blocks ?? []) {
        if (block.type === "text" && block.text) messages.push(block.text)
      }
    }
  }

  const outputSummary = messages.slice(-3).join("\n\n").slice(0, 4000) || null

  if (session.status === "terminated") {
    return {
      status: pullRequestUrl ? "succeeded" : "failed",
      pullRequestUrl,
      outputSummary,
    }
  }

  if (session.status === "idle") {
    // Idle with a PR means the work landed; idle without one means it stopped
    // early — either way there is nothing further for us to drive.
    return {
      status: pullRequestUrl ? "succeeded" : "failed",
      pullRequestUrl,
      outputSummary,
    }
  }

  return { status: "running", pullRequestUrl, outputSummary }
}

/**
 * The stub advances one step per sync so the full lifecycle — queued, running,
 * succeeded, PR link, summary — is exercisable without any credentials.
 */
export function stubSync(
  current: "queued" | "running" | "succeeded" | "failed",
  ctx: { repositoryUrl: string; branchName: string }
): BuildSync {
  if (current === "queued") {
    return { status: "running", pullRequestUrl: null, outputSummary: null }
  }

  const repoPath = ctx.repositoryUrl.replace(/^https?:\/\/github\.com\//, "")
  return {
    status: "succeeded",
    pullRequestUrl: `https://github.com/${repoPath}/pull/1`,
    outputSummary: `[stub — set ANTHROPIC_API_KEY for a real build]\n\nBranched ${ctx.branchName}, implemented the spec, and opened a pull request.`,
  }
}
