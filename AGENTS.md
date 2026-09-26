## `_build_plan/`

The `_build_plan/` folder holds the PRD, the per-milestone prompts, and a log for each milestone recording what was built, what was decided, and where the implementation deliberately departed from the PRD. It is the project's **decision record** and is kept deliberately.

It is **not** functional: no code, configuration, or runtime logic in this codebase should import, reference, or depend on anything inside `_build_plan/`.

Treat it as a historical record rather than a current specification. Each log describes the codebase as it stood at the end of that milestone, and the code has moved on since — so where a log and the code disagree, the code is authoritative. Read a log to understand *why* something is shaped the way it is, not to learn how it currently works.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
