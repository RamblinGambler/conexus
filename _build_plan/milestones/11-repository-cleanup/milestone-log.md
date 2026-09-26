# Milestone 11 — Repository cleanup

## What changed for a reader of this repository

- **The commit history now shows ten milestones instead of one commit.** It was a single squashed commit whose message described configuration files while actually containing the whole app.
- **There is a test suite** — 63 tests over encryption, the role gate, pull-request URL extraction, and the AI output schemas. `npm test` runs in under a second and needs no database, no API key, and no network.
- **There is CI.** Lint, typecheck, tests, migrations and a production build run on every push and pull request, with the badge at the top of the README.
- **`npm run typecheck` exists.** The codebase already passed `tsc --noEmit`; now there is a command for it and CI enforces it.
- **`_build_plan/` is part of the repository** rather than an untracked folder marked for deletion. Each milestone commit carries its own log, so the reasoning behind a change sits in the same commit as the change.
- **The README says what the commit history is.** It states that the history is a reconstruction and what that costs, so nobody has to infer it.

No application behaviour changed. No feature was added, and nothing from milestones 1–10 was removed.

## What was built

**The rebuilt history** — ten commits, one per milestone, replacing `7199053`. Each file was assigned to the milestone that introduced it, read off that milestone's `## What was built` section. Every commit also carries its own `_build_plan/milestones/N-*/` prompt and log.

Dates span 2026-08-05 to 2026-08-19. Seven of the ten are the real mtime of that milestone's log; milestones 4 and 5 are interpolated, because those mtimes are demonstrably wrong as an ordering signal — milestone 3 and 4's logs share a timestamp, and milestone 5's is *later* than 6, 7 and 8, meaning it was edited after the fact.

**Test suite** (Vitest 4, `vitest.config.mts`)

| File | Covers |
| --- | --- |
| `src/lib/crypto.test.ts` | round-trip including unicode and 5KB values, fresh IV per call, tampered iv / tag / ciphertext all rejected, malformed payloads, wrong key, missing `AUTH_SECRET` |
| `src/lib/roles.test.ts` | the full 4-role × 3-altitude team matrix asserted rather than sampled, solo mode opening all twelve, and altitude ownership |
| `src/lib/build/pr-url.test.ts` | extraction from prose and serialized JSON, dots and hyphens in repo names, first-match-wins, near-miss rejection, and statelessness across calls |
| `src/lib/ai/schemas.test.ts` | accept/reject fixtures for all six schemas, every field required, and a guard that the shapes stay flat — the structured-outputs API supports neither unions nor recursion |

**One source change** — `extractPullRequestUrl()` extracted from `runner.ts` into `src/lib/build/pr-url.ts`.

**Scripts** — `typecheck`, `test`, `test:watch`.

**CI** — `.github/workflows/ci.yml`: Node from `.nvmrc`, `npm ci`, then lint → typecheck → test → migrate → build, against a `postgres:16` service on port 5433.

**Reworded** — the `_build_plan/` sections of `AGENTS.md` and `_build_plan/prd.md`.

**README** — CI badge, a Checks section, and an Engineering record section.

## Decisions made during implementation

1. **The history is a reconstruction, and the repository says so.** A true replay is not reachable. Milestone 2 deleted `src/app/(app)/dashboard/` and `src/app/api/signup/`, which milestone 1 created, so no commit can contain them. Files that evolved across milestones (`src/lib/roles.ts` — M1, M2, M6; `src/db/schema.ts` — seven milestones) can only appear once, at final content. Intermediate commits are therefore not guaranteed to build, and CI is only expected green on the tip. Rather than let the history imply more than it can support, the README states what it is. The disclosure is what makes the reconstruction defensible.

2. **Losslessness was proved, not assumed.** Before any milestone-11 file was written, `git diff backup-original-history HEAD` (excluding `_build_plan/`) was empty and the tracked-file sets were identical — 146 files, same content. The partition was verified first: every tracked path assigned exactly once, no duplicates, no gaps. `backup-original-history` still points at `7199053` locally as the undo path.

3. **`extractPullRequestUrl()` was extracted rather than the regex exported.** `runner.ts` imports `@/db` at line 4, and `src/db/index.ts` throws at import time when `DATABASE_URL` is unset — so any test touching `runner.ts` would have needed a dummy-environment shim. A db-free module means the whole suite runs with no environment setup at all, which is worth more than saving a file. Behaviour is identical: the pattern has no `g` flag, so `exec` is stateless.

4. **`vitest.config.mts`, not `.ts`.** The project is not `type: module`, so a `.ts` config is loaded as CommonJS and fails on Vitest's ESM-only dependencies. The `.mts` extension is the fix; `tsconfig.json` already includes `**/*.mts`, so it is still typechecked.

5. **Tamper tests mutate the first base64url character, not the last.** The final character of a base64url string can carry bits beyond the decoded byte length, so flipping it may decode to identical bytes — the original version of that test passed while proving nothing. Noted in the test file, because the next person to write one will reach for the last character.

6. **An empty string is documented as unsupported, not fixed.** `encryptSecret("")` produces an empty ciphertext segment that `decryptSecret` rejects as malformed. No caller encrypts an empty token and rejecting is the safe direction, so the test asserts the current behaviour rather than a change being made to satisfy it.

7. **CI migrates before building.** `next build` needs `DATABASE_URL` set because of the import-time throw. Given a database is needed anyway, running the migrations first costs one step and proves all eight still apply to an empty database. Both were verified locally against a clean database before the workflow was written.

8. **Partition judgement calls.** Three assignments do not follow unambiguously from the logs: `src/app/(auth)/signup/actions.ts` → milestone 2 (milestone 1 built `api/signup`, which milestone 2 removed; the server action most likely replaced it there), `mon.mjs` → milestone 5 (it debugs Managed Agents sessions), and `docs/*-runbook.md` plus `scripts/seed-demo.ts` → milestone 10 (demo material, written last). Any of the three could belong a milestone either side.

## Deviations from the PRD

None in scope. Two additions the PRD did not specify: `test:watch` alongside `test`, and a tamper test for the iv as well as the tag and ciphertext.

The PRD's "Done when" asked for an empty `git diff backup-original-history HEAD`. As written that cannot hold, because the milestone commits also add the 21 previously-untracked `_build_plan/` files. The check was run as `git diff backup-original-history HEAD -- . ':(exclude)_build_plan'`, plus a direct comparison of the tracked-file sets. The intent — prove the partition lost nothing — is met.

## What milestone 12 will need to know

**Adding a test so CI picks it up.** Anything matching `src/**/*.test.ts` runs. Import from `@/…` — `vitest.config.mts` mirrors the tsconfig alias. Import test helpers explicitly (`import { describe, it, expect } from "vitest"`); globals are not enabled, which keeps `tsconfig.json` untouched. Test files are typechecked by `npm run typecheck`, since `include` is `**/*.ts`. CI needs no change for new test files.

**Which AI paths are reachable without an API key.** This is what the evals harness has to work with:

- `aiIsStubbed` (`src/lib/ai/client.ts`) and `buildIsStubbed` (`src/lib/build/runner.ts`) are both `!process.env.ANTHROPIC_API_KEY`.
- `generate()` returns the caller's `stub` payload when the key is absent in development, and **throws in production**. Every function in `src/lib/ai/authoring.ts` supplies a labelled stub, so all four authoring flows plus roadmap synthesis and the product brief run keyless.
- `src/lib/ai/stub-chat.ts` covers the orchestrator chat path; `stubSync()` in `runner.ts` covers build runs.
- Prompt construction is entirely pure and needs no key: `src/lib/ai/prompts.ts` (`productSection`, `blocks`, and the five builders) and `buildContext()` in `src/lib/ai/orchestrator.ts`. **These are the natural first eval targets** — a prompt-construction eval needs no network at all and can live in the normal suite.
- Anything scoring real generation quality needs a key and must stay out of `npm test`, or CI will fail on forks and on any machine without one. A separate script and workflow, or a skip-when-unset guard, keeps the default suite hermetic.

**What is not measured.** There is no eval, no LLM-as-judge, and no token, cost or latency recording anywhere. `generate()` discards `message.usage`, and `MODEL` is a hardcoded const in `client.ts` with no prompt versioning — so there is currently no way to answer what a build costs or whether a prompt change made generation better or worse. That is milestone 12's opening.
