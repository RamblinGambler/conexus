# Milestone 5 — Agent-driven build execution

## What's new in the app

- **You can connect GitHub repositories** under Settings → Repositories. Access tokens are encrypted before they're stored and are never shown again.
- **Each work item can be linked to a repository** from a new Build panel on its detail page.
- **A "Build this" button hands the work item to a coding agent.** It's disabled until there's a spec and a linked repository, and it tells you which one is missing.
- **Starting a build moves the item to In Progress** automatically.
- **You can watch the run** — Queued, Running, Succeeded, or Failed — updating live without refreshing.
- **On success you get a link to the pull request**, and the item moves itself to In Review.
- **You can read the run's output summary** to see what the agent did.
- **Build cards show their status on the board**, so you can see what's building at a glance.
- **Build-driven status changes appear in History** like every other change, attributed to the agent with the reason.

## What was built

**Schema** (`src/db/schema.ts`, migration `0003_conscious_colonel_america.sql`)
- `build_status` enum (`queued | running | succeeded | failed`).
- `repository`: name, url, `encryptedToken`, `vaultId` (the Anthropic vault holding its GitHub MCP credential).
- `work_item.repositoryId` → `repository` (`set null`).
- `build_run`: work item, repository, status, branch name, PR URL, output summary, `sessionId`, timestamps.

**Encryption** (`src/lib/crypto.ts`) — AES-256-GCM, key derived from `AUTH_SECRET`.

**Build integration** (`src/lib/build/`)
- `agent-config.ts` — the Managed Agents agent and environment definitions, plus the build system prompt.
- `runner.ts` — `startBuild()` / `syncBuild()` against Managed Agents, `stubSync()` for the no-key path, `ensureVault()`, and PR-URL extraction.

**Setup** (`scripts/setup-build-agent.ts`) — creates the agent and environment once and prints their ids.

**Actions and routes** — `build-actions.ts` (`linkRepository`, `startBuildRun`), `src/app/api/build-runs/[id]/route.ts` (poll + sync), and `settings/repositories/actions.ts`.

**UI** — `build-panel.tsx`, `settings/repositories/` (page + list), a build badge on `board/work-item-card.tsx`, and a Repositories link on the settings page.

## Decisions made during implementation

1. **Managed Agents instead of the Claude Agent SDK — a deliberate deviation from the PRD.** The Agent SDK needs a persistent filesystem and long-running processes; Vercel serverless provides neither, so it would have forced the SST/AWS migration now rather than when scale demanded it. With Managed Agents, Anthropic hosts the sandbox and runs the loop, and our server only creates sessions and reads status. It also brings native GitHub repo mounting, a git proxy that keeps the token out of the sandbox, and GitHub MCP for opening PRs. Confirmed with the user before building.

2. **The agent and environment are created once, by a script.** `agents.create()` in the request path is the documented anti-pattern — it accumulates orphaned agents, pays creation latency per run, and defeats versioning. Their ids live in `ANTHROPIC_BUILD_AGENT_ID` / `ANTHROPIC_BUILD_ENVIRONMENT_ID`.

3. **GitHub tokens are encrypted at rest.** A PAT with push access to someone's repositories does not belong in a plaintext column. The key comes from `AUTH_SECRET`, so this protects against database-level exposure (a dump, a backup, a read replica) — **not** against someone who can read the server's environment. If that matters, move to a KMS.

4. **Two different credentials, for two different jobs.** The `github_repository` session resource takes the token for cloning and pushing (Anthropic's git proxy injects it after the request leaves the sandbox). Opening a pull request goes through the GitHub MCP server, which needs its own credential from a vault. One vault per repository, created lazily on first build and cached on the row.

5. **PR URL is found by scanning session events, not by parsing one message.** The agent is asked to end with `PR_URL: …`, but the extraction regex runs over every event — the URL can just as easily appear in an MCP tool result. Trusting a single output format would be brittle.

6. **Status transitions go through `applyStatusChange()` with an `agent` actor**, exactly as milestone 4's log instructed. That is why build-driven moves land in History with a reason instead of silently mutating the row.

7. **Sync is client-polled, not webhook-driven.** Managed Agents webhooks are registered in the Anthropic Console, which needs an account this environment does not have. `GET /api/build-runs/[id]` syncs on demand while the panel polls every 2s. Webhooks would be the better production answer — see below.

8. **A terminal run is never re-synced.** Once succeeded or failed, the route returns the stored row without calling Anthropic.

## What the next milestone needs to know

There is no next milestone — this is the last one in the PRD. For whoever picks this up:

- **Run `scripts/setup-build-agent.ts` once** and put the printed ids in `.env.local` before builds will work.
- **Switch polling to webhooks** when there's a Console account: register `session.status_*` events and have the handler call the same sync logic. Polling every 2s per open panel does not scale.
- **`ensureVault()` assumes a GitHub PAT works as a `static_bearer` MCP credential.** The Anthropic docs warn that hosted MCP servers often want OAuth tokens rather than native API keys. If PR creation fails on auth, this is the first place to look.
- **The `_build_plan/` folder is now finished work.** Per its own header and `AGENTS.md`, it is temporary scaffolding and is expected to be deleted once the build-out is done.

## Deviations from the PRD

- **Managed Agents instead of the Claude Agent SDK** (decision 1) — the significant one, chosen with the user to keep the app deployable on Vercel.
- **Token encryption was added**, which the PRD did not ask for. Storing a push-capable credential in plaintext was not defensible.
- Everything in "What gets built" was delivered, and every "does NOT include" item was respected: no concurrent runs (guarded and verified), no cancel, no auto-merge, no rerun history beyond the latest, one repository per item.

## Verification

Verified in headless Chrome on a clean database — 14 checks, all passing, no console errors:

| Done-when criterion | Result |
| --- | --- |
| Link a work item to a GitHub repository | Pass |
| Trigger "Build this" | Pass — disabled with a specific reason until a spec and repo exist |
| Item moves to In Progress | Pass |
| Watch status through to a terminal state | Pass — Queued → Running → Succeeded, live |
| Item moves to In Review on success | Pass |
| Working link to the pull request | Pass |
| View the run's output summary | Pass |

Also confirmed: a second build is refused while one is active ("A build is already running"); the board card shows build status; and both status transitions appear in History attributed to the agent —

```
status  agent  Planning    → In Progress  why: Build started
status  agent  In Progress → In Review    why: Build succeeded and opened a pull request
```

**Token encryption verified at the database level**, not just in the UI: the stored column is ciphertext, a search for the plaintext across the table returns zero rows, the value round-trips back to the original, and a one-character change to the ciphertext is rejected by the GCM auth tag. The token also does not appear in the settings page source.

`npm run lint`, `npx tsc --noEmit`, and `npm run build` all pass clean. Test data deleted.
## Verified end to end against real GitHub (2026-08-11)

A real build run against a live throwaway repository completed successfully and opened **https://github.com/RamblinGambler/con-test/pull/1** — verified as open on GitHub via the API (2 files changed, +83/-1, branch `conexus/formatbyte-28cf9473` → `main`). Everything previously listed as unverified now passes:

- A Managed Agents session clones the repo, implements the spec, runs the tests, pushes a branch, and opens a PR.
- The agent used the **GitHub MCP tool** (`agent.mcp_tool_use`) to open it, and a **GitHub fine-grained PAT does work as a `static_bearer` MCP credential** — the open question from the original write-up. The earlier `HTTP 400` on MCP initialize was caused by a malformed token, not a PAT-vs-OAuth incompatibility.
- The PR-URL scan over session events found the URL correctly.
- `syncBuild()`'s status mapping is right: the app recorded `succeeded`, stored the PR URL, and moved the item to **In Review** on its own, with both transitions in History attributed to the agent (`Build started`, `Build succeeded and opened a pull request`).
- `scripts/setup-build-agent.ts` works, both for first-time creation and for in-place updates.

### Two bugs found and fixed during this verification

1. **A malformed token was accepted silently.** A value pasted as `GH-TOKEN=github_pat_…` was stored without any check, and only surfaced ~13 minutes into a build run as an opaque "credentials not available" message from inside the sandbox. `addRepository` now verifies the token against the GitHub API before storing it — rejecting whole-line pastes, non-GitHub tokens, invalid credentials, and tokens without push permission, each with a specific message.

2. **MCP tools defaulted to `always_ask`, so a PR could never have been opened.** The `mcp_toolset` entry carried no `default_config`, and the server defaults the permission policy to `always_ask`. That parks the session waiting for a `user.tool_confirmation` event the build runner never sends. Fixed by setting `permission_policy: { type: "always_allow" }` explicitly in `BUILD_AGENT_CONFIG`. **Any new MCP toolset added later needs the same treatment.** The deployed agent was updated in place (now version 2), and `setup-build-agent.ts` now updates rather than duplicating when `ANTHROPIC_BUILD_AGENT_ID` is set.

### Behaviour worth knowing

The agent reports blockers honestly rather than faking success. On the failed first attempt it finished the code, ran the tests, then said plainly: *"I could not open a pull request — the push is rejected for lack of credentials... Nothing I can fix from inside the sandbox."* It also escalates genuine ambiguity instead of guessing — the generated spec flagged the 1024-vs-1000 base and the trailing-zero formatting as decisions a human should confirm, and the PR body repeated them.

### Still open

- ~~**Runs only advance while someone is watching.** `syncBuild()` is driven by the client polling `/api/build-runs/[id]`. Close the tab mid-run and the row stays `running` until someone reopens it. Webhooks are the fix (see above).~~ **Closed by milestone 9**, with a server-side queue rather than webhooks — that route is now read-only and `src/lib/build/queue.ts` is the only writer.
