# Conexus

> **About these build-plan files:** Everything in `_build_plan/` (this PRD and the per-milestone folders) is the project's **decision record** — what was planned, what was built, and where the implementation departed from the plan and why. It is kept deliberately. These files are not functional: no code, configuration, runtime logic, tests, or deployment process should import, read, reference, or depend on anything in `_build_plan/`. Treat them as a historical record rather than a current specification — each milestone log describes the codebase as it stood when that milestone closed, so where a log and the code disagree, the code is authoritative.

## What we're building

Conexus is an AI-native kanban system that acts as the single source of truth for how a company plans, builds, and ships software — aligning executives, product managers, engineers, and designers around the same underlying work, but each viewing it at the altitude relevant to their role (roadmap for execs, PRD-level for PMs, spec-level for engineers/designers).

Conexus is built on the Builder Methods PRD Builder, Agent OS, and Design OS as foundational systems for generating and maintaining that per-role content. The app pairs a traditional kanban board (Planning → Ready → In Progress → In Review → Done) with a conversational orchestration agent that can gather information, answer questions about ongoing work, and adjust work item properties on request. A dedicated build-execution feature lets engineers hand a scoped work item directly to a coding agent, which builds it against a linked GitHub repository and reports status back to the board.

The app is built on Next.js (App Router) with TypeScript, Tailwind and shadcn/ui for the interface, PostgreSQL with Drizzle ORM for data, Auth.js for authentication, and Inngest for background/agent job orchestration. The build is structured as sequential milestones, each delivering a working, testable slice of the product: milestones 1–5 deliver the team version, Phase 2 (milestones 6–10) adds a single-operator solo mode alongside it, and Phase 3 (milestone 11 onward) prepares the repository itself to be read by others.

---

### What the app does

- Gives every work item a single home that's viewable at three altitudes — Roadmap, PRD, and Spec — without duplicating the underlying work.
- Shows executives a roadmap-level view (timeframe, business goal, plain-language "why") for every item.
- Shows product managers a PRD-level view with a guided PRD-builder flow to author problem statement, goals, and scope.
- Shows engineers and designers a spec-level view with agent-generated technical spec and design notes.
- Runs a standard kanban board (Planning, Ready, In Progress, In Review, Done) with drag-and-drop, shared across all three altitude views.
- Provides a per-item chat panel where anyone can ask the orchestration agent about an item's state or ask it to change properties or content, with every agent-made change recorded.
- Keeps a full change history per item — what changed, from what to what, who or what made the change, and why.
- Lets an engineer trigger a coding agent to actually build a scoped work item against a linked GitHub repository, showing live run status and linking to the resulting pull request.
- Automatically advances a work item's board status as a build run starts and as its pull request becomes available for review.

---

### Already provided by the existing codebase

This is a greenfield project with no starter template. Nothing is pre-built — authentication, the base app shell, dark mode, and all data models are part of Milestone 1's scope.

---

### Out of scope

- **Native mobile app** — a responsive web app covers on-the-go viewing; native app development is a separate, larger investment not needed to prove the core loop.
- **Multi-tenant / multi-company support** — Conexus is a single-company source of truth; multi-tenant SaaS architecture adds significant complexity with no v1 benefit.
- **Granular permissions/ACLs beyond role** — role sets default view and edit rights; per-user or per-project fine-grained permissions can wait until there's a proven need.
- **Third-party import** (Jira/Linear/Asana migration tooling) — not required to prove the alignment and agent-build loop.
- **Multiple AI provider/model selection** — a single provider (Anthropic) is used at launch; a provider-switching abstraction is unnecessary complexity for v1.
- **Public-facing pages / external sharing** — Conexus is an internal tool; no public roadmap pages or guest links.
- **Billing/payments** — not applicable to an internal tool.
- **Outbound notifications/integrations** (Slack, email digests, etc.) — useful later, but not core to the alignment and build loop.

---

### Data model

**User**
- name — the person's display name
- email — used to log in
- password — used to log in (email/password auth)
- role — Executive, Product Manager, Engineer, or Designer; determines default altitude view and edit rights
- avatar — a picture shown next to their name

A User can own many WorkItems. A User can author many ChatMessages and ChangeLogEntries.

**WorkItem**
- title — the short name of the work
- summary — a one-line description
- status — Planning, Ready, In Progress, In Review, or Done
- priority — Low, Medium, or High
- owner — the User responsible for this item

The WorkItem is the central card on the kanban board. Everything else attaches to it.

**RoadmapEntry**
- target timeframe — a quarter or rough date range
- business goal — what business outcome this supports
- why — a plain-language explanation of why this matters

One RoadmapEntry per WorkItem — the executive-altitude view.

**PRD**
- problem statement — what problem this solves
- goals — what success looks like
- in-scope — what this work item includes
- out-of-scope — what it explicitly excludes
- success criteria — how you'll know it's done right

One PRD per WorkItem — the PM-altitude view, authored through the guided PRD builder flow.

**Spec**
- technical approach notes — how the engineering team plans to build this
- design notes — design guidelines or considerations
- acceptance criteria — what must be true for this to be considered complete

One Spec per WorkItem — the engineer/designer-altitude view, generated via Agent OS and Design OS conventions.

**ChatMessage**
- sender — a User, or the orchestration agent
- message text — what was said
- sent at — when the message was sent

Many ChatMessages per WorkItem — the orchestration chat thread.

**ChangeLogEntry**
- field — what changed
- old value — what it was
- new value — what it became
- changed by — a User, or the orchestration agent
- why — an optional short note explaining the change
- changed at — when the change happened

Many ChangeLogEntries per WorkItem — the full decision/change history.

**Repository**
- name — the repository's name
- url — a link to the repository on GitHub

A WorkItem can be linked to one Repository, so build runs know where to build.

**BuildRun**
- status — Queued, Running, Succeeded, or Failed
- branch name — the branch the agent worked on
- pull request link — a link to the resulting PR, once opened
- output summary — a readable summary of what the agent did
- started at / finished at — when the run began and ended

Many BuildRuns per WorkItem — one per build attempt.

---

## Milestone 1 — Foundation

This milestone establishes the app's technical foundation: project scaffold, authentication, and the base authenticated shell that every later milestone builds on.

### What gets built

- A working Next.js app with Tailwind and shadcn/ui styling in place.
- Account signup and login using email and password.
- Password reset via email (using Resend for delivery).
- A logged-in app shell: navigation, user menu, and a light/dark mode toggle.
- A User's role (Executive, Product Manager, Engineer, or Designer) is set at signup and shown in their profile.
- A basic settings/profile page where a user can update their name, avatar, and role.

### What milestone 1 explicitly does NOT include

- The kanban board itself, or any WorkItem-related screens.
- The orchestration chat agent.
- Any GitHub or build-execution functionality.
- Admin tools for managing other users' roles.

### Done when

A new user can sign up with email and password, verify their role is saved, log out and back in, reset a forgotten password by email, and toggle between light and dark mode — all in the browser, with no WorkItem features present yet.

---

## Milestone 2 — Core kanban board

This milestone introduces the WorkItem model and the multi-altitude kanban board — the structural core of the product.

### What gets built

- A kanban board with five columns: Planning, Ready, In Progress, In Review, Done.
- The ability to create a new WorkItem (title, summary, priority, owner) and see it appear as a card.
- Drag-and-drop to move a card between columns, updating its status.
- Clicking a card opens a detail view with three tabs: Roadmap, PRD, and Spec (each showing placeholder/empty state until authored in Milestone 3).
- The detail view defaults to the tab matching the logged-in user's role (Executive → Roadmap, Product Manager → PRD, Engineer/Designer → Spec), while all tabs remain visible and readable to any user.
- A user can only edit the altitude tab matching their own role; other tabs are read-only for them in this milestone.

### What milestone 2 explicitly does NOT include

- Any AI-generated content in the Roadmap, PRD, or Spec tabs — those are populated in Milestone 3.
- The orchestration chat panel or change history log — those arrive in Milestone 4.
- Build execution — arrives in Milestone 5.
- Multiple boards, swimlanes, WIP limits, or saved filters.

### Done when

A logged-in user can create a WorkItem, see it on the board, drag it between all five columns, open its detail view, see the three altitude tabs with the correct one defaulted based on their role, and confirm they can only edit their own role's tab.

---

## Milestone 3 — PRD & Spec authoring

This milestone brings the PRD Builder, Agent OS, and Design OS concepts to life as in-app authoring flows.

### What gets built

- A "Build PRD" action on the PRD tab that walks a Product Manager through a guided interview (problem statement, goals, in-scope, out-of-scope, success criteria) and produces an editable PRD document attached to the WorkItem.
- A "Generate spec" action on the Spec tab that uses Agent OS conventions to produce a structured technical spec (approach and acceptance criteria) from the linked PRD content.
- A "Generate design notes" action on the Spec tab that uses Design OS conventions to produce design-related notes.
- All generated content (PRD, spec, design notes) is freely editable afterward as normal text, subject to the role-based edit rights from Milestone 2.

### What milestone 3 explicitly does NOT include

- PRD or spec version history, or any approval/sign-off workflow.
- Exporting PRD or spec content to external formats.
- Visual mockup generation or Figma integration.
- The orchestration chat agent — arrives in Milestone 4.

### Done when

A Product Manager can run the guided PRD builder on a WorkItem and see a readable PRD appear on its PRD tab; an Engineer or Designer can then generate a spec and design notes from that PRD and see them appear, editable, on the Spec tab.

---

## Milestone 4 — Orchestration chat + history log

This milestone adds the conversational layer and the full decision-history record.

### What gets built

- A chat panel on each WorkItem where any user can talk to the orchestration agent in plain language.
- The agent can answer questions about the item's current state and history.
- The agent can change the item's properties (status, priority, owner) or content (Roadmap, PRD, or Spec text) when explicitly asked, and confirms what it changed in the chat.
- A History tab on each WorkItem showing a chronological list of changes: field, old value, new value, who or what made the change, an optional "why" note, and when it happened.
- Every change made through the chat agent, or made manually elsewhere in the app, appears in the History tab.

### What milestone 4 explicitly does NOT include

- Voice input, or bulk/multi-item chat commands.
- Proactive or unprompted agent suggestions, or scheduled agent check-ins.
- Reverting a change from the History tab, searching/filtering history, or a text-diff view for long-form fields.
- Build execution — arrives in Milestone 5.

### Done when

A user can open an item's chat panel, ask the agent a question about the item and get a correct answer, ask it to change the item's priority or status and see the change applied, and then see that change reflected as a new entry in the History tab.

---

## Milestone 5 — Agent-driven build execution

This milestone connects Conexus to GitHub and lets a coding agent build a scoped work item directly from the board.

### What gets built

- A way to link a WorkItem to a GitHub Repository.
- A "Build this" action on the Spec tab, available once a Spec exists and a Repository is linked.
- Triggering a build automatically moves the WorkItem to "In Progress."
- The card and detail view show live run status: Queued, Running, Succeeded, or Failed.
- On success, a link to the resulting pull request appears, and the WorkItem automatically moves to "In Review."
- A user can view the latest build run's output summary.

### What milestone 5 explicitly does NOT include

- Running multiple concurrent build runs on the same item, or canceling a run mid-flight.
- Auto-merging a pull request on success.
- Retry or rerun history beyond the latest run.
- Linking a WorkItem to more than one repository.

### Done when

A user can link a WorkItem to a GitHub repository, trigger "Build this," watch the WorkItem move to "In Progress," see the run's status update through to Succeeded or Failed, and — on success — see the WorkItem move to "In Review" with a working link to the opened pull request.

---

# Phase 2 — Solo mode

Milestones 1–5 built Conexus for a team: four roles, each editing their own
altitude, with the handoffs between them recorded. That design is the point when
several people share the work.

For **one person building software on their own, those same handoffs are pure
friction.** A solo operator would have to hold four accounts to write a roadmap,
then a PRD, then a spec, then start a build — and would re-explain their product
on every single work item.

Phase 2 adds a **solo mode**: one person holds every altitude, and the handoffs
between people collapse into a single guided path from idea to pull request.

**Solo mode is a setting, not a replacement.** Team mode stays exactly as it is;
a workspace chooses one or the other. Nothing in milestones 1–5 is removed.

### Phase 2 data model additions

**WorkspaceSettings** — one row for the whole install
- mode — Team or Solo
- default repository — the repository new work items link to automatically
- product brief — what the product is, who it serves, its stack and conventions

**BuildQueueEntry**
- the work item waiting to build, its position, and when it was queued

**WorkItem** gains
- pull request state — open, merged, closed, or checks failing
- review notes — what the operator wants changed on the next run

---

## Milestone 6 — Solo workspace

Removes the role friction for a single operator, without touching team mode.

### What gets built

- A workspace setting that puts the install in Solo mode or Team mode.
- In Solo mode the signed-in person holds every altitude: Roadmap, PRD, and Spec
  are all editable, and nothing is read-only.
- Signup stops asking for a role when the workspace is in Solo mode.
- A default repository setting. New work items link to it automatically, so a
  solo operator never picks a repository by hand for the common case.
- The mode is visible in the interface, so it is never ambiguous which set of
  rules is in force.

### What milestone 6 explicitly does NOT include

- Removing or weakening team mode. Both modes coexist.
- Multiple workspaces, or per-user mode.
- Changing what the three altitudes are or what they contain.
- Switching an existing workspace between modes without care — a one-way setting
  at setup is enough for now.

### Done when

A single person can create a work item and edit its Roadmap, PRD, and Spec
without switching accounts, and a newly created item is already linked to the
default repository.

---

## Milestone 7 — The guided path

The heart of solo mode: one linear flow from a sentence to a running build,
replacing the tab-hopping that a team's handoffs used to justify.

### What gets built

- A "Start something new" flow, reachable from the board, that walks through:
  describe it in a sentence → answer the guided interview → review the drafted
  PRD → review the generated spec → confirm the repository → start the build.
- One step on screen at a time, with clear progress, a way back, and the ability
  to skip any step.
- The flow ends by starting the build and leaving the operator on the work item.
- Everything the flow produces is ordinary work item content — the board, tabs,
  and chat all keep working on it afterwards.

### What milestone 7 explicitly does NOT include

- Templates or preset flows for different kinds of work.
- Branching paths, or steps that depend on earlier answers beyond what the
  interview already does.
- Starting more than one item at a time.
- Replacing the existing per-tab authoring. The flow is an addition, not a
  substitute.

### Done when

From the board, a solo operator goes from a one-sentence idea to a build in
progress without leaving the flow, and the resulting work item has a roadmap
entry, a PRD, and a spec attached.

---

## Milestone 8 — Product context

A solo operator is the only source of context about their product. Making them
restate it on every work item is the largest repeated cost in the tool.

### What gets built

- A product brief held once for the workspace: what the product is, who it is
  for, the stack it is built on, and the conventions and constraints that apply
  to all work.
- Every generation reads it — the guided interview, the PRD, the spec, the design
  notes, and the brief handed to the build agent.
- On first setup, the brief can be drafted automatically from a connected
  repository, so the operator edits rather than starts from nothing.
- The brief is editable at any time and takes effect on the next generation.

### What milestone 8 explicitly does NOT include

- Per-work-item overrides of the brief.
- Version history for the brief.
- Multiple briefs, or briefs per repository.
- Automatically re-reading the repository on a schedule.

### Done when

With a product brief in place, a generated spec reflects the product's actual
stack and conventions without the operator restating them in the work item, and
clearing the brief visibly changes what is generated.

---

## Milestone 9 — Unattended execution

A solo operator cannot sit and watch a ten-minute build. Runs must make progress
whether or not anyone is looking.

### What gets built

- Build runs advance to completion without a browser tab open.
- A queue: several work items can be lined up to build, and they run one at a
  time in order.
- A single place to see everything currently queued, running, and recently
  finished.
- An email when a run finishes, saying whether it succeeded and linking to the
  pull request.

### What milestone 9 explicitly does NOT include

- Running more than one build at a time.
- Reordering or cancelling a run once it has started.
- Notifications anywhere other than email.
- Scheduled or recurring builds.

### Done when

An operator queues two work items, closes the browser, and later finds both runs
finished with pull requests, having received an email for each.

---

## Milestone 10 — Review and iterate

For a solo operator the pull request is not the end — they are also the reviewer.
Today the trail stops at the PR and the next round starts from nothing.

### What gets built

- The pull request's current state on the work item: open, merged, closed, or
  checks failing.
- "Build again with changes" — the operator describes what they want different,
  and the agent updates the same pull request branch rather than opening a new
  one.
- Merging the pull request moves the work item to Done on its own.
- Review notes are kept on the work item, so what was asked for and what changed
  stay together.

### What milestone 10 explicitly does NOT include

- Merging a pull request from inside Conexus.
- Reviewing code inside Conexus — the review happens on GitHub.
- Configuring or reading detailed CI results beyond pass or fail.
- Automatically rebuilding when checks fail.

### Done when

An operator reviews a pull request, asks for a change from the work item, sees
the same branch updated with a new commit, and merging that pull request moves
the item to Done.

---

# Phase 3 — Presenting the work

Milestones 1–10 built the product. Conexus is now about to be read by people who
have never met its author and who will judge it in a few minutes: the commit
list, whether a test suite exists, what the README links to. The code holds up.
The repository around it does not yet reflect how the code was actually built.

Phase 3 fixes that. It adds no user-facing feature and removes nothing from
milestones 1–10.

---

## Milestone 11 — Repository cleanup

Three things currently work against a reader: the entire codebase sits in one
commit whose message describes configuration files, there is no test suite at
all, and the record of why this codebase is shaped the way it is sits in an
untracked folder marked for deletion.

This milestone changes no application behaviour.

### What gets built

- **An honest commit history.** The single commit is rebuilt into a sequence
  along the milestone boundaries that already exist in
  `_build_plan/milestones/`, each message describing what that milestone
  delivered.
- **A test suite covering the logic most expensive to get wrong** — token
  encryption (`src/lib/crypto.ts`), role-based edit rights (`src/lib/roles.ts`),
  pull-request URL extraction from agent output (`src/lib/build/runner.ts`), and
  the AI output schemas (`src/lib/ai/schemas.ts`). These are pure functions; the
  stub paths that already exist for running without an API key are what make
  covering them possible without network calls.
- **`typecheck` and `test` scripts**, alongside the `lint` script that already
  exists.
- **Continuous integration** running lint, typecheck, tests, and a production
  build on every push and pull request, with its status visible in the README.
- **The build plan kept as a decision record.** `_build_plan/` is currently
  untracked and described as temporary. Its milestone logs hold the
  architectural reasoning behind this codebase — why Managed Agents instead of
  the Agent SDK, why the build agent is created by a script rather than per
  request — which makes it the most useful documentation in the project. It
  becomes tracked, and the instructions calling it temporary are corrected.

### What milestone 11 explicitly does NOT include

- **An evals harness for the AI features** — that is milestone 12, and it is the
  larger piece of work. This milestone adds no measurement of generation
  quality.
- Tests that call the Anthropic API, reach the network, or need a live database.
- End-to-end or browser tests.
- README work beyond the CI badge — screenshots, an architecture diagram, and a
  demo video are separate.
- A deployed demo environment.
- A LICENSE file, or tidying stray root-level scripts.
- Any change to application behaviour, schema, or migrations.

### Done when

`npm run lint`, `npm run typecheck`, and `npm test` all pass on a fresh clone and
in CI; the commit list tells the story of how the project was built; and
`_build_plan/` is tracked, with nothing left in the repository describing it as
temporary.
