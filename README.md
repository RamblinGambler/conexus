# Conexus

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
