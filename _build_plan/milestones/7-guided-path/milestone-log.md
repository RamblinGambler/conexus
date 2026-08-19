# Milestone 7 — The guided path

## What's new in the app

- **"Start something new" takes you from a sentence to a running build** in one path — no tab-hopping, no switching screens.
- **Six clear steps** with progress along the top: describe it, answer a few questions, review the requirements, review the spec, confirm the repository, build.
- **Everything is drafted for you and stays editable** — the requirements and spec appear as normal fields you can correct before they are saved.
- **The roadmap writes itself** from the same answers, so the executive view is filled in without asking you anything extra.
- **Skip any step.** Skipping still leaves you with a complete, usable work item.
- **If a build can't run, the flow says why** before you click, rather than failing afterwards.
- **Nothing is lost if you leave.** Each step saves as you go; an abandoned flow is just an ordinary item on your board.
- **The result is a normal work item.** The board, tabs, chat, and history all work on it exactly as before.

## What was built

**Roadmap generation** — `roadmapDraftSchema` (`src/lib/ai/schemas.ts`), `ROADMAP_SYNTHESIS_SYSTEM` + `roadmapSynthesisPrompt` (`prompts.ts`), `synthesizeRoadmapDraft()` with a labelled stub (`authoring.ts`), and a `synthesizeRoadmap` action.

**`applyGeneratedDraft` widened** from `Exclude<Altitude, "roadmap">` to all three altitudes, so agent-authored roadmap content is credited the same way PRD and spec content is.

**The flow** — `src/app/(app)/new/page.tsx` (server component, redirects out of team mode) and `guided-flow.tsx` (client, holds step state).

**Entry point** — a solo-only "Start something new" button in `board/board.tsx`; `board/page.tsx` now passes `mode`.

**Login moved server-side** — new `src/app/(auth)/login/actions.ts`; `login-form.tsx` calls it instead of `next-auth/react`'s `signIn`.

**Validation cap raised** — `optionalText` in `src/lib/validation.ts`, 5,000 → 50,000 characters.

## Decisions made during implementation

1. **The flow is solo-only.** Confirmed with the user. No single role can finish it in team mode — the interview is PM-gated and spec generation is engineer/designer-gated — so `/new` redirects to the board there and the button is hidden. Offering it would be a broken promise.

2. **The roadmap is derived, not asked for.** The PRD's step list has no roadmap step but its "Done when" expects a roadmap entry. Rather than add a step or leave it blank, the roadmap is synthesised from the same interview transcript as the PRD, in parallel with it.

3. **The derived roadmap is applied without review.** It is context the operator did not come here to write, one more review screen would work against the milestone's whole point, and it stays editable on the item afterwards. The PRD and spec — the things they *did* come to write — are both reviewed.

4. **Review steps show editable fields, not milestone 3's accept/skip diff.** On a new item every field is empty, so a diff against nothing is noise. Editing inline also beats applying and then navigating to the item to fix a line. The diff preview is untouched for editing established items.

5. **The item is created at step one.** Every generation action takes a `workItemId` and reads context from the database, so the item must exist before the interview can run. That also means each step persists as it completes, which is why abandoning mid-flow is safe.

6. **Skips are handled honestly.** Skip the spec or leave the repository unlinked and the build step *explains why it cannot run* and offers to finish, rather than presenting a button that fails on click.

## Bugs found and fixed during verification

- **Generated specs were silently rejected.** `optionalText` capped altitude fields at 5,000 characters. Milestone 3's live test passed because its generated content was short; a richer interview produced a spec well past the cap, and `applyGeneratedDraft` failed validation with nothing written. Raised to 50,000 — these are `text` columns, so the cap is a sanity bound, not a product limit. **Worth knowing: this failed as a toast, not a crash, so a shorter test would not have caught it.**

- **Login had the same `MissingCSRF` race that signup had in milestone 1.** Login still used the client-side `signIn`, whose CSRF-token fetch can race with the freshly-set cookie on a cold server. It blocked verification outright. Now a server action (`login/actions.ts`) that signs in server-side, mirroring the signup fix. The action also **restricts `callbackUrl` to in-app paths**, so a crafted URL can't bounce someone off-site after authenticating. Milestone 4's log predicted this: *"If Milestone 3+ adds another sign-in path, do it server-side for the same reason."*

## What the next milestone needs to know

- **Milestone 8's product brief should be threaded into `src/lib/ai/prompts.ts`**, which now has four system prompts (interview, roadmap, PRD, spec/design). Adding it there covers the flow automatically — the flow calls the same actions.
- **`applyGeneratedDraft` now accepts all three altitudes.** Use it for any agent-authored write so history credits it correctly.
- **Server actions infer an optional `error`**, so `result.error` narrows to `string | undefined`. `guided-flow.tsx` handles this with a `fail(message: string | undefined)` helper rather than asserting at each call site.
- **The flow does not survive a refresh.** The transcript and unapplied drafts live in component state; applied content is already saved. Resuming mid-flow would need the step and transcript persisted — not required by the PRD, and worth weighing against the cost.
- **Milestone 6's three-Save-buttons friction is now avoidable** for new work: the flow saves each step as it goes. It remains for items edited through the tabs.

## Deviations from the PRD

- **A roadmap step was added in substance but not as a screen** (decision 2) — the PRD's step list and its "Done when" disagreed, and this satisfies both without adding a step.
- Everything else in "What gets built" was delivered, and every "does NOT include" item was respected: no templates, no branching, one item at a time, and the per-tab authoring is untouched.

## Verification

Verified in headless Chrome against a solo workspace — 13 checks on the full path, 6 on the skip paths, 2 on the team-mode guard. No console errors.

**Full path:**

| Check | Result |
| --- | --- |
| Entry point on the board; six steps shown | Pass |
| Interview starts and accepts answers | Pass |
| PRD drafted and editable | Pass |
| Spec drafted | Pass |
| Repository pre-filled from the workspace default | Pass |
| Build starts; lands on the work item In Progress | Pass |
| Item ends with roadmap **and** PRD **and** spec content | Pass — the PRD's "Done when" |
| An inline edit made during the flow survived to the item | Pass |
| History shows 11 agent-attributed rows, roadmap included | Pass |

**Skips and recovery:**

| Check | Result |
| --- | --- |
| Skipping the interview still drafts a PRD | Pass |
| Skipping the PRD reaches the spec | Pass |
| Back returns to the previous step with content intact | Pass |
| Skipped spec → build explains itself and is not offered | Pass — *"This needs a spec before a build can run — you skipped that step."* |
| Finish without building | Pass |
| Abandoning mid-flow leaves a normal item on the board | Pass |

**Team mode:** the entry point is absent and `/new` redirects to `/board`.

`npm run lint`, `npx tsc --noEmit`, and `npm run build` all pass clean.

**One caveat on the build check.** The repository used was a fixture with a placeholder token, so the run starts and the item moves to In Progress — which is what this milestone's "Done when" requires — but the run itself would fail later at git push. Milestone 5 already verified a real build end to end against a live repository and a genuine pull request; this milestone verifies that the flow *starts* one correctly.

Test data was removed, the demo seed re-run, and the workspace left in **team mode** so `docs/demo-runbook.md` still works.
