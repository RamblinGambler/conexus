# Milestone 8 — Product context

## What's new in the app

- **A Product brief in Settings**, written once for the whole workspace: what the product is, who it's for, what it's built with, and the conventions that always apply.
- **Everything generated now knows your product** — the interview, the roadmap, the PRD, the spec, the design notes, the chat agent, and the brief handed to the build agent. You stop restating it on every work item.
- **Each generation gets only what it needs.** The spec sees your stack and conventions; the interview sees what the product is and who it's for.
- **"Draft from a repository"** reads a connected repo's README and config files and fills the brief in for you to edit.
- **An empty brief changes nothing** — leave it blank and generations behave exactly as before.
- **The brief takes effect on the next thing you generate.** No rebuild, no re-linking.

## What was built

**Schema** (`src/db/schema.ts`, migration `0005_wild_radioactive_man.sql`) — four nullable text columns on the existing `workspace_settings` singleton: `productName`, `productAudience`, `productStack`, `productConventions`. No new table.

**Prompt threading** (`src/lib/ai/prompts.ts`)
- `ProductBrief` / `ProductPart` types, and `WorkItemContext` gains a `product` field.
- `productSection(product, parts)` renders only the requested fields and returns `null` when they are empty.
- `blocks(...)` joins prompt sections, dropping empty ones.
- All five builders — interview, roadmap synthesis, PRD synthesis, spec, design notes — now compose through `blocks()` with their own field selection.

**Population points** — `loadContext()` in `work-items/[id]/actions.ts` (the only place `WorkItemContext` is built), and `startBuild()`'s caller in `build-actions.ts` for the build agent.

**Other surfaces** — `briefFor()` in `src/lib/build/runner.ts` (`BuildContext` gains `product`), and `buildContext()` in `src/lib/ai/orchestrator.ts` for chat.

**Repository draft** — `src/lib/product-brief.ts` (`draftBriefFromRepository`), plus `productBriefSchema`, `PRODUCT_BRIEF_SYSTEM` / `productBriefPrompt`, and `draftProductBrief()` following the milestone 3 generation pattern.

**UI and actions** — `settings/product-card.tsx`, `updateProductBrief` and `draftProductBriefFromRepository` in `settings/workspace-actions.ts`, `setProductBrief()` in `lib/workspace.ts`, `productBriefSchema` in `lib/validation.ts`.

## Decisions made during implementation

1. **Four structured fields, not one free-text brief.** Confirmed with the user. It tells the operator what actually matters, gives the repository draft clear slots to fill, and — the real reason — lets each prompt take only the parts relevant to it.

2. **Per-prompt field selection.** The spec and build agent get name, stack, and conventions; the interview, roadmap, and PRD get name and audience; design notes get name, audience, and conventions. Sending the whole brief everywhere would put stack details into an interview about user problems.

3. **An empty brief renders nothing at all.** `productSection` returns `null` rather than an empty heading, and `blocks()` drops it. This is what makes "clearing the brief changes the output" true rather than approximately true — and it is directly verified.

4. **Chat reads the brief, which is slightly beyond the PRD's list.** The PRD names the generations. But chat can already rewrite the PRD and spec, so without the brief it would produce content contradicting every other flow. That inconsistency would be a bug, not a scope saving.

5. **The repository draft reads files over the GitHub API rather than sending a coding agent.** README, `package.json`, `AGENTS.md`, `CONTRIBUTING.md`, `CLAUDE.md` — whichever exist, each capped at 12,000 characters. Seconds and one model call, against roughly ten minutes and a full sandbox session for a draft the operator is going to edit anyway. Missing files are skipped rather than failing.

6. **The draft fills the form; it does not save.** The operator reviews before it becomes standing context for every future generation.

7. **The brief prompt is told to admit gaps.** Where the files are silent it must say so rather than guess — an invented convention here is inherited by everything generated afterwards, which is worse than an obvious blank.

## Bug found and fixed during verification

**A deleted account locked the browser out of the app entirely, with `ERR_TOO_MANY_REDIRECTS`.** Unrelated to this milestone's feature, but surfaced by it — repeated verification runs delete test users, and any browser still holding that user's cookie became unusable.

The proxy and the pages disagreed about what "signed in" means:

1. `src/proxy.ts` calls `auth()`, which only verifies the JWT. The token is still valid, so the request is admitted.
2. The page calls `getCurrentUser()` (`src/lib/session.ts`), which resolves the user **from the database**. The row is gone, so it redirects to `/login`.
3. `/login` is public and the session still looks valid, so the proxy bounces it back to `/board`.
4. Repeat — reproduced at 19 redirects before the browser gave up.

The damage is worse than it sounds: the loop also blocks `/login`, so the person cannot sign in as anyone else or reach any part of the app. Only clearing cookies by hand recovers it.

**The fix** is a `GET /signed-out` route handler (`src/app/(auth)/signed-out/route.ts`) that calls `signOut({ redirect: false })` and redirects to `/login`. Clearing the cookie is what breaks the cycle. Two supporting changes make it work:

- `src/proxy.ts` treats `/signed-out` as public **and** exempts it from the signed-in bounce via `SIGNED_IN_ALLOWED` — otherwise the proxy would redirect the very route that exists to break the loop.
- All six guards inside `(app)` now redirect to `/signed-out` rather than `/login`. **All six matter:** layouts and pages render concurrently, so one guard still pointing at `/login` would restart the loop.

Verified by reproducing it — sign in, delete the user row underneath the live session, then navigate. Before: `ERR_TOO_MANY_REDIRECTS` after 19 hops. After: two redirects, landing on `/login`. Regression-checked that normal sign-in, the signed-in bounce off `/login`, every guarded page, and normal log out all still work.

## What the next milestone needs to know

- **`WorkItemContext.product` is populated in exactly one place** — `loadContext()`. Any new generation that takes that type gets the brief automatically.
- **Two surfaces build prompts outside that type** and need updating by hand if they change: `briefFor()` in `build/runner.ts` and `buildContext()` in `ai/orchestrator.ts`.
- **`productSection` is the only renderer.** Use it rather than formatting brief fields inline, so the empty-brief behaviour stays consistent.
- **`getWorkspaceSettings()` returns the brief columns directly**, so it satisfies `ProductBrief` structurally — no mapping layer needed.
- Milestone 9 changes nothing here; the brief is already read on every path a queued or unattended build would take.

## Deviations from the PRD

- **Chat reads the brief** (decision 4), which the PRD's list did not include.
- Everything else in "What gets built" was delivered, and every "does NOT include" item was respected: no per-item overrides, no version history, one brief, and no scheduled re-reads.

## Verification

`npm run lint`, `npx tsc --noEmit`, and `npm run build` pass clean. Verified in headless Chrome against a solo workspace, with live model calls.

**The PRD's "Done when" is a comparison, so the same spec was generated three times** — this cannot be shown by a single generation:

| Brief state | Stack terms in the generated spec |
| --- | --- |
| Not set | none |
| Set to *"Elixir with Phoenix, Ecto, LiveView"* | `phoenix`, `liveview`, `ecto` — plus `exunit` and `context` from the conventions field |
| Cleared again | none |

The work item and its summary were identical each time; only the brief changed. That is the criterion met in both directions.

**Prompt assembly**, asserted directly against the builders:

| Check | Result |
| --- | --- |
| A null brief renders nothing | Pass |
| An all-empty brief renders nothing | Pass |
| A partial brief renders only the fields that are set | Pass |
| An empty brief adds no product block to the spec prompt | Pass |
| The spec prompt gets stack and conventions | Pass |
| The spec prompt omits audience | Pass |
| The interview prompt gets audience but not stack | Pass |
| Design notes get audience and conventions | Pass |

**Chat**, live: asked what the product is built with, the agent answered *"Elixir on the Phoenix framework, using Ecto… server-rendered LiveView only"* — from the brief, not the work item.

**Build brief:** the composed product block carries stack and conventions and omits audience, matching the selection `briefFor()` uses.

No console errors.

**Repository draft, verified against a live repository** (`RamblinGambler/con-test`, real fine-grained token, real GitHub contents API). This was the one item the milestone shipped unverified; it now passes.

| Check | Result |
| --- | --- |
| Draft control appears once a repository is connected | Pass |
| All four fields fill from one call | Pass — 13s |
| The draft is grounded in *this* repository's files | Pass — names Node, ES modules, JSDoc, `TypeError`, `node:test` |
| Present files are read, absent ones skipped without failing | Pass — `README.md` and `package.json` read; `AGENTS.md`, `CONTRIBUTING.md`, `CLAUDE.md` absent (404) and skipped |
| Drafting does not save on its own | Pass — asserted in the database, brief still `NULL` after drafting |
| No console errors | Pass |

The draft's quality holds up on the point that matters most: it distinguished what the files stated from what they did not, ending with *"the actual contents of `src/` were not visible here"* and *"treat those as unspecified rather than assuming a standard"* — rather than inventing a lint or CI convention.

**Failure paths, each exercised against a real database row** — `verifyToken()` only guards the *add* path, so these are the states a repository can be in later:

| State | Result |
| --- | --- |
| Repository id not found | `Repository not found` |
| Token revoked after it was added | `Couldn't read anything from that repository — check the token still has access.` |
| Ciphertext undecryptable (e.g. `AUTH_SECRET` rotated) | `Could not read that repository's access token` |
| Repository deleted or renamed | `Couldn't read anything from that repository — check the token still has access.` |

All four return a typed error the card shows as a toast — no crash, and no token material in any message.

Test data was removed, the demo seed re-run, the product brief left **empty**, and the workspace left in **team mode** so `docs/demo-runbook.md` behaves as rehearsed.
