# Milestone 9 — Unattended execution

## What's new in the app

- **Builds finish on their own.** Start one and close the tab, shut the laptop, walk away — the run keeps going on the server and lands without you.
- **You can line several up.** Queue as many work items as you like; they build one at a time, in the order you queued them.
- **A new Builds page** in the top nav shows what is running now, what is waiting and in what order, and the last ten runs with links to their pull requests.
- **An email when each run finishes**, saying whether it worked and linking straight to the pull request.
- **A failed build no longer blocks the ones behind it** — it is reported and the queue moves on.

## What was built

**The queue** — `src/lib/build/queue.ts` (new). One exported `tickBuildQueue()` that advances whatever is running, then claims the next queued run if the queue is free. Safe to call from anywhere, at any frequency.

**What drives it:**

| Driver | File | Role |
| --- | --- | --- |
| Interval, every 10s | `src/instrumentation.ts` (new) | The default. Starts with the server, so runs advance with nothing watching. |
| `POST /api/build-queue/tick` | `src/app/api/build-queue/tick/route.ts` (new) | For serverless, where no process survives between requests. Bearer-authenticated. |
| Enqueue | `build-actions.ts` | A non-blocking nudge so a lone build starts now instead of waiting out the interval. |

**Schema** — two columns on `build_run` (`src/db/migrations/0006_lean_marrow.sql`):

- `started_by_user_id` — the queue runs with no request and no session, so it has no `getCurrentUser()`. This is the actor it attributes the In Review move to, and the address it emails.
- `notified_at` — the queue revisits finished rows every few seconds; without this a run would be emailed about forever.

`created_at` already gave FIFO ordering, so no position column was needed.

**Email** — `sendBuildFinishedEmail()` in `src/lib/resend.ts`, alongside the existing password-reset sender and using the same shape: Resend when `RESEND_API_KEY` is set, console otherwise in development, throw in production.

**UI** — `/builds` (`src/app/(app)/builds/page.tsx` + `auto-refresh.tsx`), the first nav links in `src/components/nav-bar.tsx`, and a line in the work item's build panel telling the operator they can close the page.

## Decisions made during implementation

**The polling route is now read-only, and that is the central change.** `GET /api/build-runs/[id]` used to *do the work* — call `syncBuild()`, persist the transition, and move the item to In Review. A queue doing the same thing concurrently would double-write and double-email, so all transitions moved into `tickBuildQueue()` and the route just returns the stored row.

That fixed an attribution bug in passing. The In Review change used to be credited to **whoever happened to have a tab open**, because the route used the polling user's id as the actor. It is now credited to whoever started the run.

**The claim is one SQL statement**, not a read followed by a write:

```sql
UPDATE build_run SET status='running', started_at=now()
WHERE id = (SELECT id FROM build_run WHERE status='queued' ORDER BY created_at LIMIT 1)
  AND NOT EXISTS (SELECT 1 FROM build_run WHERE status='running')
RETURNING id
```

Checking "is anything running?" and then writing leaves a window where two callers both see an idle queue and both start a build — exactly the concurrency the PRD rules out. There are now three things that can tick (interval, cron, enqueue), so that window would have been hit. Verified under eight simultaneous ticks: one claim.

**`started_at` moved** from enqueue time to the moment the agent session is created. Once runs wait their turn, "started" at enqueue is simply false, and the queue page reports waiting time from it.

**Crash recovery.** A run is claimed before its session exists. A process that dies in that window leaves a row nothing will ever advance — and since only one run may be active, that row blocks *everything*. A `running` run with no session id for over two minutes is written off as "Build did not start".

**`notified_at` is stamped even when the send throws.** Otherwise a broken mail config would retry on every tick forever. The cost is one lost email instead of an infinite loop.

**The cron endpoint is disabled, not open, when `BUILD_QUEUE_SECRET` is unset** — it returns 503. Anyone who can reach it can start builds.

## Bug found and fixed during verification

**A run whose repository had been deleted finished in total silence.** It was marked `failed` correctly, but by a bare database update that bypassed the notification path, so `notified_at` stayed null and no email was sent. The operator would have seen a build simply never arrive.

Caught by the queue-resilience test, which checked the *queue* kept moving but then found only one email for two finished runs. Both failure paths in `claimNext` now route through the same `finish()` helper as every other terminal state. Silence is the one thing an unattended queue must never do.

## Verification

`npx tsc --noEmit`, `npm run lint`, and `npm run build` pass clean, with `/builds` and `/api/build-queue/tick` registered.

The PRD's "Done when" is **two runs finishing with the browser closed**, so it was run exactly that way, against a server with `ANTHROPIC_API_KEY` unset. The stub exercises the full lifecycle in seconds rather than twenty minutes; the queue mechanics are identical either way.

**The criterion, measured:**

| Check | Result |
| --- | --- |
| Two items queued through the UI, browser then closed | At close: Alpha `succeeded`, Beta `running` |
| Beta finished with no browser in existence | **Pass — 3.2s after the browser process closed** |
| Both ended `succeeded` with pull request URLs | Pass |
| One at a time | **Pass — 200 samples at 4Hz, concurrent `running` never exceeded 1** |
| In queue order | Pass — Beta started 0.05s *after* Alpha finished |
| One email per run, to the right person | Pass — 2 emails, both to `marcus@conexus.demo`, who pressed Build |
| Email content | Correct subject, PR link, work item link, summary |
| In Review attributed to the starter, not a tab-holder | Pass — asserted in `change_log_entry` |

**The rest:**

| Check | Result |
| --- | --- |
| `notified_at` prevents a second email | Pass — 15 further ticks, email count unchanged |
| Eight simultaneous ticks | Pass — exactly one run claimed, the other stayed queued |
| A failed run does not wedge the queue | Pass — bad run failed, the one behind it still ran |
| A failed run is emailed too | Pass — *after the fix above* |
| The poll route can no longer mutate | Pass — row hash unchanged after 3 polls; 401 unauthenticated |
| Tick endpoint with no secret | 503, disabled |
| Tick endpoint, wrong secret | 401, state unchanged |
| Tick endpoint, correct secret | Drove the queue to completion **with the interval disabled entirely** |
| `/builds` shows running, queued in order, finished with PR links | Pass |
| `/builds` follows external changes with no reload | Pass |
| Console errors, hydration warnings | None |

**Not verified.** Live Anthropic builds were not re-run here — that is the full end-to-end run being saved until after the milestones. What that leaves untested is `syncBuild()` against a real session under the queue rather than under the old client polling; the stub covers the state machine around it, not the Managed Agents call itself. Live email delivery is also unverified, since `RESEND_API_KEY` is empty — the rendered message was asserted from the console path. A real external scheduler calling the tick endpoint was not exercised, only the endpoint.

## What the next milestone will need to know

- **`tickBuildQueue()` is the only writer of build run state.** Anything that needs to react to a run finishing belongs in `finish()` in `src/lib/build/queue.ts`, not in a route.
- **`started_by_user_id` is the actor for anything the queue does.** There is no session out there; do not reach for `getCurrentUser()` in queue code.
- Milestone 10 (review and iterate) will want the pull request, which is already on the run as `pull_request_url`, and the work item is already in In Review by the time the operator looks.
- Two new env vars, documented in `.env.example`: `BUILD_QUEUE_TICK_MS` (default 10000, `0` disables) and `BUILD_QUEUE_SECRET` (unset disables the cron endpoint).

## Deviations from the PRD

None in scope. Concurrency, reordering, cancelling, non-email notifications, and scheduled builds were all left out as the PRD specifies.

Webhooks were considered — milestone 5's log named them as the production fix, and the SDK does expose `session.idled` and `session.status_terminated` with signature verification. They were **not** built: they need a public HTTPS URL and console configuration, so the leg could not be verified on localhost, and a missed webhook strands a run with no recovery. The interval is the reliable driver and the cron endpoint covers serverless. Webhooks remain a latency optimisation on top, not a prerequisite.

## Still open

- A build that fails leaves its work item in **In Progress**. Nothing moves it back, and nothing retries. Out of scope here; worth deciding in milestone 10.
- The queue is global, so one repository's slow build blocks every other repository's. Fine for a solo operator, wrong for a team.
- `syncBuild()` lists every session event on each tick. At a 10s interval over a ten-minute build that is ~60 full event scans — works, but it is the obvious thing to make incremental if runs get long.

## Verification state left behind

Test work items removed, all build runs cleared, workspace left in **team mode** with the product brief empty and one repository connected — the same state milestone 8 left, so `docs/demo-runbook.md` still behaves as rehearsed. The dev server runs with the queue ticking every 10s.
