# Conexus — solo operator runbook

Taking one app idea from a blank database to a merged pull request, as one
person, with no second account anywhere in the story.

**The spine is a single loop, not a tour.** Describe the idea → answer a few
questions → review what was drafted → build → review the pull request → ask for
changes → merge. Everything else in Conexus exists to keep that loop honest.

Working time: about **25 minutes of your attention**, spread across a build that
runs for 5–15 minutes without you.

---

## Part 0 — Before you start

### What you need

| Thing | Why | Without it |
|---|---|---|
| Docker + Node | Postgres and the app | Nothing runs |
| `ANTHROPIC_API_KEY` | Interviews, drafting, and the build agent | Generation returns clearly-labelled stub text; builds refuse |
| A GitHub repo you can push to | Where the agent opens its pull request | Everything works up to the build step |
| A fine-grained GitHub token | Cloning, pushing, opening the PR | The repository is rejected when you add it |
| `RESEND_API_KEY` | The "your build finished" email | The email is logged to the server console instead |

**The GitHub token needs, on that one repository:** Contents **read and write**,
Pull requests **read and write**, Metadata **read** (forced). Add Checks **read**
if you want CI status on the work item — without it the app shows "checks
unavailable" and carries on.

### Starting genuinely fresh

The mode choice is offered **only when no account exists yet**. On a database
that already has users you will not see it, which is the single most common way
this walkthrough goes wrong.

```bash
docker compose down -v          # destroys the database — that is the point
docker compose up -d
npm run db:migrate
npm run dev
```

**Do not run `scripts/seed-demo.ts`.** That creates the four team-demo accounts
and takes first-run away from you.

### Pre-flight

- [ ] `http://localhost:3000/signup` loads and says *"You're the first one here"*
- [ ] Your GitHub repo has at least a `README.md` — the product brief is drafted
      by reading it
- [ ] The server console is visible somewhere; the build email lands there if
      Resend is unconfigured
- [ ] Dev server warm — load a page once so the first click isn't a compile

---

## Part 1 — The setup, once

### Step 1 — Create the workspace (2 min)

Go to `/signup`. Because nothing exists yet, you get a **Mode** choice. Pick
**Solo — one person, every altitude**.

What that buys you, and it is worth knowing before you click:

- No role is asked for, now or ever.
- Roadmap, PRD, and Spec are all yours to edit. In team mode each is locked to a
  role, and a solo operator would otherwise be locked out of two-thirds of their
  own work item.
- The three altitudes become **sections on one scrolling page** rather than tabs
  you switch between.
- A **Solo** badge replaces the role badge in the nav.

You can change this later in Settings; roles are kept but not enforced.

### Step 2 — Connect the repository (2 min)

**Settings → Repositories → Add repository.** Give it a name, the HTTPS URL, and
the token.

The token is **verified when you add it** — format, validity, and that it can
actually push. A token that looks right but cannot push is rejected here rather
than 13 minutes into a build. It is encrypted before storage and never shown
again.

### Step 3 — Set the default repository (30 sec)

**Settings → Workspace → Default repository.** In solo mode new work items link
to it automatically, so the build step is pre-filled every time instead of being
one more thing to remember.

### Step 4 — Write the product brief once (3 min)

**Settings → Product.** Four fields: what the product is, who it is for, what it
is built with, and the conventions that always apply.

Click **Draft** and pick your repository. It reads the repo's `README.md`,
`package.json`, and whichever of `AGENTS.md` / `CONTRIBUTING.md` / `CLAUDE.md`
exist, and fills all four fields in about 15 seconds. **It does not save** —
review it, fix what it got wrong, then **Save product brief**.

**This is the highest-leverage three minutes in the whole runbook.** Every
generation from here on reads it, so you never restate your stack or your
testing conventions on an individual work item. Set it badly and you will fight
every draft; set it well and the specs come out sounding like your codebase.

> Expect the draft to be honest about its limits. Drafted from a README alone it
> will say so, and flag what it could not see rather than inventing a CI setup
> you do not have.

---

## Part 2 — The loop

### Step 5 — Start something new (5 min of typing, ~4 min of waiting)

From the board, **Start something new**. Six steps across the top:

**Describe** → a title and a few sentences. Write it the way you would explain
the idea to a colleague. This is the only place you supply raw intent.

**Questions** → an interview, five or six questions, one at a time. Answer two
or three properly and click **Finish early** when it stops being useful. The
interview exists to get specifics out of your head, not to be completed.

**Requirements** → the PRD is drafted from your answers: problem, goals, in
scope, out of scope, success criteria. It arrives as **normal editable fields**.
Read the out-of-scope list especially closely — it is where a drafted PRD most
often quietly commits you to something you did not mean.

**Spec** → technical approach and acceptance criteria, drafted in your stack and
your conventions because the product brief is in the prompt.

**Repository** → already filled from your default. Confirm.

**Build** → if anything is missing, the flow tells you *before* you click:
"This needs a linked repository before a build can run."

Every step saves as you go, and every step can be skipped. **Leaving halfway
does not lose anything** — an abandoned flow is just an ordinary work item on
your board.

> **Scope the idea to the repository you pointed at.** A production-scale spec
> aimed at a near-empty repo produces a partial pull request and a polite note
> explaining why. That is the agent behaving correctly, but it is not the demo
> you wanted. Ask for something the repo can actually hold.

### Step 6 — Walk away (5–15 min, unattended)

Click build and **close the tab**. This is the part worth actually testing,
because it is the part a solo operator lives on.

- The run continues on the server. Nothing depends on a browser being open.
- Queue several items and they run **one at a time, in order** — the repository
  is never being edited by two agents at once.
- **`/builds`** in the nav shows what is running, what is queued and in what
  position, and the last ten finished with links to their pull requests.
- You get an **email when each one finishes**, saying whether it worked and
  linking to the pull request. If Resend is unconfigured, that email is printed
  in full to the server console — same content, same recipient.

Meanwhile the work item moves itself: **into In Progress** when the build
starts, then **In Progress → In Review** when the pull request opens. Both
appear in **History**, attributed to you and marked as agent moves.

### Step 7 — Review, and iterate (5 min + another build)

Open the work item. The **Review** card shows the pull request's number and its
live state — Open, Merged, Closed, or Checks failing, refreshed on the server
about once a minute.

Read the diff **on GitHub**. Conexus deliberately does not try to be a code
review tool.

Then, back on the work item, use **Build again with changes**: describe what you
want different in plain words.

- It goes back to **the same agent session**, which still remembers what it
  built, and pushes to **the same branch** — the existing pull request gains a
  commit rather than a second PR appearing.
- The item returns to In Progress, and the ask is recorded on the work item next
  to the round it produced. The review timeline reads: built → *"you asked:
  tighten the error copy"* → round 2.
- If nothing actually lands on the branch, the round is marked **failed** rather
  than reported as a success. A rebuild is judged on the branch moving, not on
  whether a pull request URL appears somewhere.

Repeat as many rounds as the work needs.

### Step 8 — Merge, and it closes itself (1 min)

Merge the pull request **on GitHub**. Within about a minute Conexus notices and
moves the work item to **Done** on its own, recorded in History as *"Pull request
merged"*.

You never told Conexus you were finished. That is the whole point of the loop:
the board reflects what is true in the repository, rather than asking you to
keep it in sync by hand.

---

## Part 3 — What this does and does not do for you

**Honest strengths for one person:**

- The context you would otherwise repeat lives in one place and is read by every
  generation.
- Builds do not require your attention, and a queue means you can line up an
  afternoon's work and leave.
- The record of *why* something was built stays attached to the thing that was
  built — PRD, spec, the change you asked for, and the pull request, on one page.
- Nothing needs a second person to unblock it.

**Where you will hit the edges:**

- **A failed build leaves the item in In Progress** with no retry. You move it
  back by hand.
- **A pull request closed without merging does nothing** — the state shows, but
  the item sits in In Progress forever. There is no "abandoned" path.
- **The queue is global.** A slow build in one repository blocks builds in every
  other repository. Fine for one person, wrong the moment you are two.
- **No scheduled or recurring builds**, and no automatic rebuild when checks
  fail.
- **You cannot merge from inside Conexus**, by design.
- **Review notes are change requests only.** There is nowhere to jot "looks fine,
  revisit the error handling later" without triggering a build.

---

## Appendix — when something goes wrong

| Symptom | Cause | Fix |
|---|---|---|
| No Mode choice at signup | An account already exists | `docker compose down -v`, migrate, sign up again |
| Repository rejected when adding | Token cannot push, or is malformed | Re-issue with Contents read+write on that repo |
| Build fails within seconds | Build agent not configured | `npx tsx scripts/setup-build-agent.ts` |
| Build never leaves Queued | The queue is not ticking | Check the server logged `[build-queue] ticking every 10000ms` at startup |
| No completion email | `RESEND_API_KEY` unset | It is in the server console, printed in full |
| "Checks unavailable" on the PR | Token lacks Checks: read | Add the permission, or ignore it — PR state still updates |
| Generated spec looks generic | Product brief empty or vague | Settings → Product; drafts inherit whatever you put there |
| Redirected in a loop after a database reset | A cookie for a deleted user | Visit `/signed-out` once |

**Deploying beyond your laptop:** the queue rides on a long-lived server
process. On serverless there is no such process, so point a cron at
`POST /api/build-queue/tick` with an `Authorization: Bearer $BUILD_QUEUE_SECRET`
header. Without that secret set the endpoint is disabled rather than open.
