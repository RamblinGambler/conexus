# Milestone 2 — Core kanban board

## What's new in the app

- **There's a board now, and it's the first thing you see.** Signing in takes you straight to it. The placeholder dashboard is gone.
- **You can create work items.** Give one a title, summary, priority, and owner, and it appears in the Planning column.
- **You can drag cards between the five columns** — Planning, Ready, In Progress, In Review, Done. The move sticks after a reload, and the card snaps back if a save fails.
- **Each card opens its own page** with the work item's details and three tabs: Roadmap, PRD, and Spec.
- **The right tab opens automatically for your role.** Executives land on Roadmap, Product Managers on PRD, Engineers and Designers on Spec.
- **Everyone can read every altitude.** An executive can read the PM's PRD and the engineer's spec — that's the point of a shared source of truth.
- **You can only edit the tab that matches your role.** Other tabs show their content greyed out with a note saying who owns it. This is enforced on the server, not just hidden in the UI.
- **The three altitudes have real fields to fill in** — Roadmap (timeframe, business goal, why), PRD (problem, goals, in/out of scope, success criteria), and Spec (technical approach, design notes, acceptance criteria).
- **Cards show what matters at a glance:** title, summary, priority, and the owner's avatar.

## What was built

**Schema** (`src/db/schema.ts`, migration `0001_third_thunderbird.sql`)
- `work_item_status` enum (`planning | ready | in_progress | in_review | done`) and `work_item_priority` enum (`low | medium | high`).
- `work_item`: title, summary, status, priority, `ownerId` → `user.id` (`ON DELETE SET NULL`), `position` for ordering within a column, timestamps.
- `roadmap_entry`, `prd`, `spec`: one row per work item (unique FK, `ON DELETE CASCADE`), all text fields nullable.
- `workItemsRelations` wires `owner`, `roadmapEntry`, `prd`, `spec` for Drizzle's `with:` queries.

**Shared logic**
- `src/lib/roles.ts` — gained `ALTITUDES`, `ALTITUDE_LABELS`, `ALTITUDE_BY_ROLE` (moved out of the old dashboard page), `canEditAltitude()`, `rolesForAltitude()`.
- `src/lib/work-items.ts` — `WORK_ITEM_STATUSES`, `WORK_ITEM_PRIORITIES`, and their label helpers. The board renders columns from this list.
- `src/lib/types.ts` — `BoardItem` / `BoardUser` shared between server pages and client components.
- `src/lib/validation.ts` — added `createWorkItemSchema`, `updateWorkItemCoreSchema`, `moveWorkItemSchema`, `roadmapSchema`, `prdSchema`, `specSchema`.

**Board** (`src/app/(app)/board/`) — `page.tsx` (server), `board.tsx` (DndContext + optimistic state), `board-column.tsx` (droppable), `work-item-card.tsx` (sortable card + drag overlay body), `new-work-item-dialog.tsx`, `actions.ts` (`createWorkItem`, `moveWorkItem`).

**Detail** (`src/app/(app)/work-items/[id]/`) — `page.tsx` (server, async `params`), `work-item-detail.tsx` (tabs + field descriptors), `work-item-header.tsx` (core fields), `altitude-form.tsx` (one form reused for all three altitudes), `actions.ts` (`updateWorkItemCore`, `updateRoadmap`, `updatePrd`, `updateSpec`).

**Removed** — `src/app/(app)/dashboard/`, `src/app/api/signup/`. All `/dashboard` references repointed to `/board`.

**Dependencies** — `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`; shadcn `dialog`, `tabs`, `textarea`.

## Decisions made during implementation

1. **The three tabs got real editable fields, not placeholders.** The PRD said tabs show "placeholder/empty state until authored in Milestone 3" but also that users can only edit their own role's tab in Milestone 2 — which requires something editable. Confirmed with the user: build the real structured fields now (manual entry, no AI); Milestone 3 layers generation on top of these same fields.

2. **Detail view is a page at `/work-items/[id]`, not a modal.** A "source of truth" tool needs linkable work items.

3. **The board replaced the dashboard** rather than sitting beside it. `/` and post-login redirects now go to `/board`.

4. **Altitude gating is enforced in the server actions.** `requireAltitudeAccess()` in the detail `actions.ts` re-checks `canEditAltitude()` before every write. Disabled inputs are only a hint — this was tested by calling the action directly (see Verification).

5. **Who can do what:** any signed-in user can create work items, edit core fields (title/summary/priority/owner), and drag cards. Only the three altitude tabs are role-restricted, which is exactly what the PRD limits. Status is changed by dragging on the board, not from the detail page — the detail page shows it as a read-only badge.

6. **Cards carry a `position` integer.** The PRD only required moving between columns, but dnd-kit's sortable lets users reorder within a column and it would visually snap back without persisted ordering. `moveWorkItem` rewrites positions for the destination column inside a transaction.

7. **Signup now signs in server-side** (`src/app/(auth)/signup/actions.ts`), replacing the `/api/signup` route plus client-side `signIn()`. This fixed a real intermittent bug — see below.

8. **Altitude rows are created eagerly** with the work item, in the same transaction, so every tab always has a row to update. No upsert logic needed.

9. **Layout widths:** the `(app)` shell went from `max-w-6xl` to `max-w-[100rem]` so five columns fit without horizontal scrolling; columns are `min-w-56 flex-1` so they share available width. The detail page constrains itself to `max-w-4xl` for readable form fields.

## Bugs found and fixed during verification

- **`MissingCSRF` on signup (intermittent).** The client called `signIn()` right after the signup POST; its CSRF-token fetch could race with the freshly-set cookie, and the sign-in silently failed, dumping the new user back on `/login`. It reproduced on a cold server and passed on a warm one. Fixed by creating the account and calling Auth.js's **server-side** `signIn()` in one server action, which sets the cookie directly with no CSRF round-trip. **If Milestone 3+ adds another sign-in path, do it server-side for the same reason.**
- **Hydration mismatch on the board.** dnd-kit derives its `aria-describedby` from a module-level counter, so the server rendered `DndDescribedBy-0` and the client `DndDescribedBy-3`. Fixed with a stable `id="conexus-board"` on `DndContext`. Any future `DndContext` needs its own explicit `id`.

## What the next milestone needs to know

- **Milestone 3 fills these same fields, it does not create new ones.** The generation flows write to `roadmap_entry`, `prd`, and `spec` — the rows already exist for every work item. Reuse `AltitudeForm`'s field descriptors in `work-item-detail.tsx` (`FIELDS`) as the field list to generate into.
- **Go through the existing actions.** `updateRoadmap` / `updatePrd` / `updateSpec` already enforce the altitude gate. A "Generate spec" button should call an action that reuses `requireAltitudeAccess()` rather than writing to the tables directly.
- **`getCurrentUser()`** (`src/lib/session.ts`) remains the only source for the caller's role. `session.user.role` still does not exist.
- **Forms use `react-hook-form` + `zodResolver` with the shadcn `Field*` primitives.** Note: schemas used in `useForm` must not use `.optional().default()` — that makes zod's input and output types differ and `zodResolver` won't typecheck. Use a plain required string and allow `""`, converting to `NULL` in the action.
- **Adding a column** means adding to `WORK_ITEM_STATUSES` in `src/lib/work-items.ts` and to the `work_item_status` enum via a migration.
- **The board re-syncs from the server** via the "adjust state during render" pattern in `board.tsx` (not `useEffect` — the React Compiler lint rule rejects `setState` in an effect).

## Deviations from the PRD

- **Tabs are editable now rather than placeholders**, per decision 1 above — confirmed with the user, and required by the same milestone's role-gating requirement.
- **Added `position` to the data model.** The PRD's data model didn't mention card ordering; it's needed for coherent drag-and-drop (decision 6).
- **The signup mechanism changed** (decision 7) while its behaviour stayed the same. This touched Milestone 1 code to fix a real defect.
- Everything in "What gets built" was delivered; nothing was cut.

## Verification

Verified in headless Chrome against the running dev server, on a cold start with an empty database.

| Done-when criterion | Result |
| --- | --- |
| Create a work item, see it on the board | Pass — appears in Planning |
| Drag it between all five columns | Pass — Ready → In Progress → In Review → Done all landed |
| Status persists | Pass — still in Done after reload |
| Detail view shows three altitude tabs | Pass — Roadmap, PRD, Spec all visible to every role |
| Correct tab defaults per role | Pass — Executive→Roadmap, PM→PRD, Engineer→Spec, Designer→Spec |
| Can only edit own role's tab | Pass — own tab editable, other two disabled with a lock notice and no Save button |

**Server-side gate, tested by bypassing the UI.** Both a PM and an Engineer POSTed the same `updatePrd` server action directly with the same payload:

- PM → `200`, wrote `"LEGIT PM WRITE"` to the database.
- Engineer → `{"error":"Only Product Managers can edit this view"}`, database unchanged.

Also confirmed: an Executive can read the PM's PRD content; `npm run lint`, `npx tsc --noEmit`, and `npm run build` all pass clean; no browser console errors, including no hydration warnings.

Test accounts and work items were deleted afterwards; the dev database is empty. Deleting the work items also removed their `prd` rows, confirming the cascade works.

**Not verified:** keyboard-based drag-and-drop (dnd-kit's `KeyboardSensor` is not wired up — only `PointerSensor` is), and concurrent edits by two users on the same work item.
