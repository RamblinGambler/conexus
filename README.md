# Conexus

[![CI](https://github.com/RamblinGambler/conexus/actions/workflows/ci.yml/badge.svg)](https://github.com/RamblinGambler/conexus/actions/workflows/ci.yml)

The AI-native source of truth for how a company plans, builds, and ships software — one work item, viewed at the altitude that matches your role.

## Stack

Next.js 16 (App Router) · TypeScript · Tailwind v4 · shadcn/ui · PostgreSQL · Drizzle ORM · Auth.js v5 · Resend

## Getting started

Requires Node 20.19+ (see `.nvmrc`) and Docker.

```bash
nvm use
npm install
cp .env.example .env.local   # then fill in the values below
docker compose up -d         # Postgres on localhost:5433
npm run db:migrate
npm run dev
```

Open <http://localhost:3000> and create an account.

### Environment variables

| Var | Required | Notes |
| --- | --- | --- |
| `DATABASE_URL` | yes | Matches `docker-compose.yml` (port **5433**, to avoid clashing with other local Postgres instances) |
| `AUTH_SECRET` | yes | Generate with `openssl rand -base64 32` |
| `NEXTAUTH_URL` | yes | `http://localhost:3000` in development |
| `ANTHROPIC_API_KEY` | no in dev | Powers the PRD builder and spec generation. Without it, generation returns clearly-labelled stub content in development and throws in production |
| `ANTHROPIC_BUILD_AGENT_ID` | for builds | Created by `npx tsx scripts/setup-build-agent.ts`. Without it, builds run against a stub in development |
| `ANTHROPIC_BUILD_ENVIRONMENT_ID` | for builds | Created by the same script |
| `RESEND_API_KEY` | no in dev | Without it, password reset links are printed to the server console instead of emailed |
| `RESEND_FROM_EMAIL` | no in dev | Needs a domain verified in Resend; `onboarding@resend.dev` works for testing |

### Build execution

Builds run on Anthropic Managed Agents. Create the agent and sandbox once, then
copy the printed ids into `.env.local`:

```bash
npx tsx scripts/setup-build-agent.ts
```

Add repositories under **Settings → Repositories**. Each needs a GitHub token
with Contents read/write (to push branches) and pull request access (to open
PRs); tokens are encrypted before storage.

### Database commands

```bash
npm run db:generate   # create a migration from schema changes
npm run db:migrate    # apply pending migrations
npm run db:studio     # browse the database
```

### Checks

```bash
npm run lint
npm run typecheck     # runs next typegen first; works on a clean checkout
npm test              # npm run test:watch to iterate
```

The suite covers the logic most expensive to get wrong — token encryption, the
role-based edit gate, pull-request URL extraction from agent output, and the AI
output schemas. It is deliberately free of network, API and database access, so
it needs no environment setup. CI runs all three checks plus a production build
and the migrations against a clean Postgres.

## Engineering record

[`_build_plan/`](_build_plan/) is kept as this project's decision record rather
than deleted as scaffolding. Alongside the original PRD, each
[milestone log](_build_plan/milestones/) records what was built, what was
decided that the PRD did not specify, and where the implementation deliberately
departed from the plan. Some worth reading on their own:

- [Milestone 5](_build_plan/milestones/5-agent-driven-build-execution/milestone-log.md)
  — why build execution runs on Anthropic Managed Agents instead of the Claude
  Agent SDK, and why the build agent is created once by a script rather than per
  request.
- [Milestone 9](_build_plan/milestones/9-unattended-execution/milestone-log.md)
  — why one idempotent queue tick is driven by three different callers.
- [Milestone 10](_build_plan/milestones/10-review-and-iterate/milestone-log.md)
  — why a rebuild is just another build run, and why that meant no
  pull-request table was needed.

**On the commit history:** this project was built in the ten milestones above,
but its history was originally committed as a single squashed commit. On
2026-09-26 that commit was rebuilt into one commit per milestone, partitioning
the tree by the milestone that introduced each file, with dates taken from the
milestone logs. It is an accurate map of what each milestone delivered, but it
is a reconstruction rather than a recording: files created and later deleted do
not appear, files that evolved across several milestones show only their final
content, and intermediate commits are not guaranteed to build. The milestone
logs, not the commit history, are the primary record.
