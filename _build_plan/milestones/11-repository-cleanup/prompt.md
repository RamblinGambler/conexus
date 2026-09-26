# Milestone 11 — Repository cleanup

You are entering plan mode to plan and then build milestone 11 of this project.

## Context

- Read `@_build_plan/prd.md` for the full project context, scope, data model, and tech stack. Milestones 1–5 built the **team** version of Conexus; milestones 6–10 added **solo mode**. Milestone 11 opens **Phase 3 — Presenting the work**: it changes no application behaviour and adds no user-facing feature. Nothing in milestones 1–10 is removed.
- Read the milestone logs for milestones 1 through 10 in `@_build_plan/milestones/`. In this milestone they are not only background — they are an input. The commit history you rebuild is derived from them, and they are the artifact being promoted to a tracked decision record.
- This milestone deliberately reverses an earlier instruction. `@AGENTS.md` and the note at the top of `@_build_plan/prd.md` both describe `_build_plan/` as temporary and expected to be deleted. That was correct while the folder was scaffolding; it is wrong now that the milestone logs are the best available record of why this codebase is shaped the way it is. Correcting both statements is in scope. The other rule they carry — that no code, configuration, or runtime logic may depend on anything inside `_build_plan/` — still holds and must survive the rewording.
- `npx tsc --noEmit` currently passes clean across the codebase. Keep it that way.
- There is no test runner in the project yet. Choosing one is part of this milestone.

## Sequencing

Rebuild the commit history **first**, before writing any new file. The rewrite replays the existing tree; new untracked work sitting in the middle of it will either be swept into the wrong commit or lost. Tests, CI, and the `_build_plan/` promotion are then ordinary commits on top of the rebuilt history.

The existing single commit has already been pushed to `origin/main`, so the rebuilt history can only reach the remote through a force-push. Do not force-push without asking the user first, in that moment, even if they have approved the rewrite in principle.

## Your task

1. Plan the implementation for **only** milestone 11 as defined in the PRD. Do not plan or build the evals harness — that is milestone 12.
2. After the user confirms the plan, build only what is in milestone 11's scope.
3. Verify your work against the "Done when" criteria for milestone 11 in the PRD. Verify on a fresh clone, not only in this working tree — a passing local run proves less than it appears to here, since the thing being fixed is what a stranger sees when they clone.
4. When complete, write a `milestone-log.md` in this folder (`_build_plan/milestones/11-repository-cleanup/milestone-log.md`). Structure it as follows:
   - **Start with a `## What changed for a reader of this repository` section at the very top**, in place of the `## What's new in the app` section the other milestone logs use. This milestone ships no user-facing feature, so that heading would be empty or misleading. Write instead a short, scannable list of what someone opening this repository will now find that they would not have found before.
   - Then include the implementation detail sections below for the next milestone's agent to reference:
     - What was built (test files added, workflow added, scripts added, files reworded)
     - Any decisions made during implementation that weren't pre-specified in the PRD
     - Anything the next milestone will need to know — in particular, how to add a test so CI picks it up, and which of the AI code paths are reachable without an API key, since milestone 12's evals will build directly on both
     - Any deviations from the PRD and why

Before you plan, resolve these with me using the AskUserQuestion tool:

- **Author dates on the rebuilt commits.** The rewrite happens today, but the work spanned weeks. Either every commit carries today's date, or each is dated from its milestone log's modification time. Do not invent dates that were never real.
- **Which test runner**, given the project currently has none.
- **How the commits divide.** Ten milestones is the obvious split, but milestone 1 carries the scaffold and the dependency lockfile and may deserve more than one commit.

Ask me any other clarifying questions using AskUserQuestion tool to lock in the implementation plan for this milestone.
