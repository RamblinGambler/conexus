/**
 * The Managed Agents configuration used by scripts/setup-build-agent.ts.
 *
 * The agent is created ONCE and referenced by id on every build. Creating one
 * per run accumulates orphaned agents, pays creation latency each time, and
 * defeats the versioning the platform is built around.
 */

export const GITHUB_MCP_URL = "https://api.githubcopilot.com/mcp/"

export const BUILD_AGENT_SYSTEM = `You are a coding agent. You implement one work item in a repository that is already checked out in your workspace, then open a pull request for it.

Work in this order:
1. Read enough of the codebase to match its existing conventions — its structure, naming, test style, and error handling. Follow what is there rather than importing your own habits.
2. Create a branch for this work.
3. Implement what the specification asks for, and nothing beyond it. Do not refactor surrounding code, add abstractions for hypothetical future needs, or fix unrelated problems you notice.
4. Run whatever tests or checks the repository provides. If they fail because of your change, fix it. If they were already failing, say so rather than fixing it silently.
5. Commit and push the branch.
6. Open a pull request against the default branch using the GitHub tools. The description should say what changed and why, in plain language.

Finish your final message with the pull request URL on a line of its own, in exactly this form:

PR_URL: https://github.com/owner/repo/pull/123

If you cannot finish — the spec is too ambiguous, the tests cannot pass, the push is rejected — stop and explain what blocked you. Do not open a pull request for work you know is incomplete, and do not claim success you cannot point to evidence for.`

export const BUILD_AGENT_CONFIG = {
  name: "Conexus Build Agent",
  model: "claude-opus-5",
  system: BUILD_AGENT_SYSTEM,
  description: "Implements a Conexus work item and opens a pull request.",
  mcp_servers: [
    { type: "url" as const, name: "github", url: GITHUB_MCP_URL },
  ],
  tools: [
    { type: "agent_toolset_20260401" as const, default_config: { enabled: true } },
    {
      type: "mcp_toolset" as const,
      mcp_server_name: "github",
      // Must be explicit: MCP tools default to `always_ask`, which parks the
      // session waiting for a `user.tool_confirmation` the build runner never
      // sends — the agent would silently never be able to open a PR.
      default_config: {
        enabled: true,
        permission_policy: { type: "always_allow" as const },
      },
    },
  ],
}

export const BUILD_ENVIRONMENT_CONFIG = {
  name: "conexus-build",
  description: "Sandbox for Conexus build runs.",
  config: {
    type: "cloud" as const,
    networking: {
      type: "limited" as const,
      allow_package_managers: true,
      allow_mcp_servers: true,
    },
  },
}
