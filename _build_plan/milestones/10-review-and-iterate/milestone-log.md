# Milestone 10 — Review and iterate

## What's new in the app

- **The work item now tracks its pull request** — open, merged, closed, or checks failing — instead of the trail going cold once the PR is opened.
- **"Build again with changes"**: describe what you want different and the agent updates the *same* pull request instead of opening a second one.
- **Merging finishes the work.** Merge on GitHub and the item moves itself to Done, with the move recorded in History.
- **A review timeline on the work item** showing each round: what was built, what you asked for next, and what that produced — the ask and the change sitting together.
- **The Builds page shows pull request state** on finished runs, so merged and failing work is visible at a glance.

## What was built

| Piece | File |
| --- | --- |
| GitHub reads — PR state, checks, branch head | `src/lib/build/github.ts` (new) |
| PR polling and merge-to-Done | `src/lib/build/pull-requests.ts` (new) |
| Review timeline + change request UI | `src/app/(app)/work-items/[id]/review-panel.tsx` (new) |
| `resumeBuild()` | `src/lib/build/runner.ts` |
| `requestChanges()` | `src/app/(app)/work-items/[id]/build-actions.ts` |
| `judge()`, rebuild promotion, `syncPullRequests()` step | `src/lib/build/queue.ts` |

**Schema** (`src/db/migrations/0007_round_iron_patriot.sql`) — all on `build_run`, because a rebuild is just another run: `review_note`, `parent_run_id` (self-reference), `base_sha`, and the cached `pr_number` / `pr_state` / `pr_checks` / `pr_checked_at`.

A rebuild copies `branch_name` and `pull_request_url` forward from its parent, so **the newest run for a work item always carries the current pull request**. That is what the polling and the UI read, and it is why no separate pull-request table was needed.

## Decisions made during implementation

**A rebuild cannot be judged the way a first build is.** `syncBuild()` decides success by finding a pull request URL anywhere in the session's events. For a first build that is right. For a rebuild it is actively wrong — the URL from the turn that *opened* the PR is still sitting in the same transcript, so a retry that changed nothing would report success. `judge()` in `queue.ts` therefore scores a rebuild on whether the branch head moved off `base_sha`, captured at enqueue. That is also exactly what the operator was promised: the same branch, updated with a new commit.

This is not theoretical — it fired during verification. The stub reported success *and* a pull request URL, and the run was still correctly marked failed with "No new commit landed on main".

**Resuming, with a real fallback.** `resumeBuild()` sends the change request into the existing session with `events.send()`. Sessions were observed still `idle` **8 days** after their build finished, so this is the common path, and the agent keeps everything it already knew about the branch. When the session is gone or terminated, a fresh one is created with `checkout: { type: "branch", name }` — the repository mounted already on the PR's branch, which is what keeps the work on the same pull request either way. The fresh path re-states the original brief; the resumed path does not, because the session already has it.

**Polling reuses milestone 9's ticker** rather than adding a second scheduler, with a 60-second staleness floor per pull request. The queue ticks every 10s, which is right for a build that is actively running and far too eager for a PR waiting on a human. `pr_checked_at` is stamped even when the read *fails*, so an unreadable pull request retries on the normal cadence instead of on every tick.

**Checks degrade rather than fail.** A fine-grained token needs an explicit "Checks: read" permission the operator may not have granted. A non-OK response is recorded as `unknown` and never fails the sync — the pull request's own state, which matters much more, still updates.

**Merged-to-Done is guarded on the previous state** (`run.prState !== "merged"`), so re-ticking cannot write the history row twice. Verified: still exactly one row after many further ticks.

## Verification

`npx tsc --noEmit`, `npm run lint`, and `npm run build` pass clean.

**Live, against the real repository** (`RamblinGambler/con-test`, real token, real GitHub API):

| Check | Result |
| --- | --- |
| PR state read from the live API | Pass — `#1`, `open`, checks `none` (the repo genuinely has no CI) |
| 60s throttle actually throttles | Pass — 3 forced ticks + the interval over 12s, `pr_checked_at` unchanged |
| **PR #1 merged on GitHub → item moves to Done on its own** | **Pass, with no browser open** |
| Recorded as an agent move in History | Pass — `In Review → Done`, actor `agent`, attributed to the person who started the run, reason "Pull request merged" |
| No duplicate move on later ticks | Pass — still exactly 1 history row after ~35s of ticking |
| `readPullRequest` on a missing PR / undecryptable token | Returns null, no throw |
| `readBranchHead` on a real and a missing branch | Real SHA / null |

**The rebuild leg, against a stub server:**

| Check | Result |
| --- | --- |
| The new run carries the note, the parent link, and **the parent's branch and PR URL** | Pass — asserted before any tick could overwrite it |
| `base_sha` captured at enqueue | Pass — real SHA from GitHub |
| Item moves back to In Progress, recorded as an agent change | Pass |
| A second round is refused while one is in flight | Pass |
| **Unchanged branch head marks the rebuild failed** despite the stub reporting success and a PR URL | Pass |
| A merged PR is refused **server-side**, not just hidden in the UI | Pass — page rendered with the form, `pr_state` flipped to `merged` underneath the client, click returned "That pull request is already merged" and created no run |
| Review timeline shows build → ask → round | Pass |
| Merged item shows a Merged badge and no rebuild form | Pass |
| Console errors, hydration warnings | None |

### A mistake worth recording

The rebuild test was first run against the dev server holding the **real** `ANTHROPIC_API_KEY`, so `resumeBuild()` was not stubbed and **started an actual Managed Agents session** against the repository — the live run that was explicitly being deferred. The session was archived as soon as it was spotted, and the repository was checked and found untouched: `main` still at the merge commit, no new branches, no new pull requests. It had gone idle without pushing. The test was then redone properly against a stub server, which is what the results above are from.

### Not verified

- **No live agent run.** `resumeBuild()` is unexercised against a real session — both the `events.send()` resume and the fresh-checkout fallback ship verified by construction only. Whether a real agent, given the follow-up brief, actually pushes to the same branch instead of opening a second pull request is the single biggest open question in this milestone.
- **The `unknown` checks path never executed.** It needs a token that can read pull requests but not checks, which cannot be simulated with the one token available. The `none` result was real; the 403 degradation is by construction.
- **PR #1 is now merged** and cannot be reused. A future demo or live run needs a fresh pull request.

## What the next milestone will need to know

- **`syncPullRequests()` only polls the newest run per work item**, and skips items already `done`. Anything that needs older runs refreshed has to change that rule.
- **A rebuild is identified by `review_note` being non-null.** That single field is what makes the queue resume rather than start over.
- `judge()` in `queue.ts` is where "what did this run achieve" is decided — new run types belong there, not in `syncBuild()`.
- Work items are only moved to `done` when `started_by_user_id` survives; a deleted user leaves the PR state updated but the item unmoved.

## Deviations from the PRD

None. Merging from inside Conexus, code review inside Conexus, detailed CI configuration, and auto-rebuild on failed checks were all left out as specified.

## Still open

- **A failed build or rebuild leaves the item in In Progress** with nothing to retry it — carried over from milestone 9 and still true.
- **Closed-without-merge does nothing.** The state is shown, but the item stays In Progress forever; there is no "abandon" path.
- The review timeline grows without bound on a long-running item — no collapsing after a few rounds.

## Verification state left behind

Test work items removed, all build runs cleared, workspace left in **team mode** with the product brief empty, the 5-item demo seed intact, and one repository connected. The dev server runs with the queue ticking every 10s. **PR #1 in the throwaway repo is merged**; its branch `conexus/formatbyte-28cf9473` still exists.
