# Milestone 6 — Solo workspace

## What's new in the app

- **The workspace can run in Solo or Team mode.** Solo is for one person building alone; Team keeps the four-role behaviour exactly as it was.
- **The first person to sign up chooses which**, and it can be changed later in Settings.
- **In Solo mode you own everything.** Roadmap, PRD, and Spec are all editable — nothing is read-only, and you never switch accounts to fill in your own work.
- **Solo puts the whole item on one page.** The three altitude tabs become three sections you scroll through; History keeps its own tab.
- **Solo stops asking about roles.** No role at signup, no role selector in Settings — the nav shows a `Solo` badge instead.
- **New work items link to a default repository automatically**, so you don't pick one every time.
- **Team mode is untouched.** Role restrictions, per-altitude tabs, and the role badge all behave exactly as before.

## What was built

**Schema** (`src/db/schema.ts`, migration `0004_rich_lady_mastermind.sql`)
- `workspace_mode` enum (`team | solo`).
- `workspace_settings` — a singleton row: `mode` (default `team`), `defaultRepositoryId` → `repository` (`set null`), timestamps.

**Workspace helper** (`src/lib/workspace.ts`) — `getWorkspaceSettings()`, `getWorkspaceMode()`, `isFirstRun()`, `setWorkspaceMode()`, `setDefaultRepository()`, and the fixed `WORKSPACE_SETTINGS_ID`.

**The gate** (`src/lib/roles.ts`) — `canEditAltitude(role, altitude, mode)` gains a required third parameter and returns `true` for everything in solo. Also `SOLO_DEFAULT_ROLE`.

**Enforcement points updated** — `requireAltitudeAccess()` in `work-items/[id]/actions.ts`, and `altitudeRefusal()` inside `buildToolImpls()` in `src/lib/ai/orchestrator.ts` (now takes `mode`, supplied by the chat route).

**UI** — `settings/workspace-card.tsx` + `settings/workspace-actions.ts` (mode and default repository), solo layout in `work-item-detail.tsx`, first-run mode question and conditional role field in `signup-form.tsx` / `signup/page.tsx`, `showRole` on `profile-form.tsx`, and a mode badge in `nav-bar.tsx`.

**Also changed** — `createWorkItem` applies the default repository; `signupSchema.role` is optional and `signUp` resolves it server-side; `profileSchema.role` is optional.

## Decisions made during implementation

1. **`mode` is a required parameter on `canEditAltitude`, not optional.** This function decides write access. A required parameter makes the compiler point at every call site; an optional one would let a site silently keep team rules. It found the single remaining UI call site immediately.

2. **Both enforcement points read the mode server-side, never from the caller.** `requireAltitudeAccess()` and the chat route each load it themselves. If the chat gate had been missed, chat would have stayed *stricter* than the UI in solo mode — a confusing failure rather than an unsafe one, but still wrong.

3. **Mode is changeable in Settings, not one-way.** Confirmed with the user, and a slight softening of the PRD's "one-way setting at setup is enough". Switching only changes who may edit what — roles stay stored, no data migrates — so the cost of allowing it is low and it lets someone evaluate both modes without wiping the database.

4. **Roles are hidden in solo but still stored.** Solo signups get `SOLO_DEFAULT_ROLE` (`product_manager`, arbitrary but stable). Nothing about the schema changes, which is exactly what makes switching back to Team mode work — every account still has a role to enforce.

5. **Solo keeps two tabs rather than one long page.** Work (three stacked altitude sections) and History. Putting a long change list under the authoring fields would bury them; the friction being removed was hopping *between altitudes*, not seeing history.

6. **The settings row is created lazily at a fixed UUID** with `onConflictDoNothing`, so two concurrent first requests can't create two rows.

7. **The default repository applies to new items only**, as the PRD scopes it. Existing items keep whatever they had — verified.

## What the next milestone needs to know

- **Milestone 7's guided path should read `getWorkspaceMode()`** and assume solo. Everything it needs is unlocked: one person can already write all three altitudes through the existing gated actions.
- **`getWorkspaceSettings()` is the place to add settings.** It already returns the singleton and creates it on demand; add columns rather than a second table.
- **`src/lib/workspace.ts` is server-only** — it imports `db`. Client components take `mode` as a prop. Milestone 4 broke the production build by importing a db-touching module into a client component; don't repeat it.
- **Three Save buttons on the solo page is real friction.** Each altitude section saves independently. Milestone 7's flow should save the whole item at once rather than making the operator click Save three times.
- **Adding a new gated surface** means passing `mode` into `canEditAltitude` — the compiler will insist.

## Deviations from the PRD

- **Mode is changeable in Settings** rather than strictly one-way at setup (decision 3), agreed with the user.
- Everything else in "What gets built" was delivered, and every "does NOT include" item was respected: team mode is intact, there is still one workspace, per-user mode does not exist, and the three altitudes are unchanged.

## Verification

Verified in headless Chrome on a clean database — 12 UI checks plus database-level gate tests, no console errors.

**Team mode did not regress:**

| Check | Result |
| --- | --- |
| First run offers the mode question | Pass |
| Team signup asks for a role | Pass |
| Per-altitude tabs kept (Roadmap, PRD, Spec, History) | Pass |
| A PM is still blocked from the Spec | Pass |
| Nav shows the role | Pass |

**Solo mode:**

| Check | Result |
| --- | --- |
| Collapses to two tabs (Work, History) | Pass |
| Roadmap, PRD, and Spec all editable | Pass |
| All three persist after reload | Pass |
| Nav shows `Solo`; role selector hidden in Settings | Pass |
| Solo signup asks no role; mode question only on first run | Pass |
| New item auto-links to the default repository | Pass — the pre-existing item was correctly left unlinked |

**The gate was tested by bypassing the UI, in both directions.** The same `updateSpec` action was POSTed directly as a Product Manager:

- **Solo:** succeeded — `technical_approach` became `DIRECT POST BY PM`. The server gate genuinely opened, not just the disabled attribute.
- **Team (after switching back):** `{"error":"Only Engineers and Designers can edit this view"}`, and the column still read `RESET`.

**The chat gate was tested separately**, since it is a second enforcement point. In solo, a Product Manager asked the agent to set the spec's technical approach; it did, and the database confirmed `Solo chat wrote this.` In team mode this same request was refused in milestone 4.

`npm run lint`, `npx tsc --noEmit`, and `npm run build` all pass clean. Test data was removed, the demo seed re-run, and **the workspace left in team mode** so `docs/demo-runbook.md` still tells the four-role story.
