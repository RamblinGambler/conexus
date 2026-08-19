# Conexus — demo runbook

A recording script for a mixed audience of executives, product managers, and
engineers, plus the follow-up material each group will ask for.

**The spine of the demo is one work item's life, seen by four people.** Resist
the urge to tour every screen. The point is not "here are our features" — it is
"here is one thing being built, and everyone is looking at the same record of
it."

Target length: **12–14 minutes** of recording.

---

## Part 0 — Before you record

### Setup

```bash
docker compose up -d
npm run dev
npx tsx scripts/seed-demo.ts     # idempotent; leaves real build runs alone
```

Accounts (all password `supersecret1`):

| Who | Email | Role | Opens on |
|---|---|---|---|
| Dana Reyes | `dana@conexus.demo` | Executive | Roadmap |
| Priya Shah | `priya@conexus.demo` | Product Manager | PRD |
| Marcus Bell | `marcus@conexus.demo` | Engineer | Spec |
| Ines Okafor | `ines@conexus.demo` | Designer | Spec |

### The one thing that will ruin the take

**A real build run takes 10–13 minutes.** You cannot record it live. The plan
below starts a build to show the trigger and the status change, then cuts to
**"Add a formatBytes helper"**, which already has a real merged-ready pull
request from an earlier run. Say *"here's one I started earlier"* — that is
honest and nobody minds.

### Pre-flight checklist

- [ ] Four browser profiles (or windows) signed in as the four people, so you
      never record a login screen
- [ ] `https://github.com/RamblinGambler/con-test/pull/1` open in a tab
- [ ] Light mode; browser zoom ~110%; notifications off
- [ ] Dev server warm — load `/board` once so the first click isn't a compile
- [ ] Rehearse the PRD interview once. It asks 5–6 questions; **you will answer
      two and click "Finish early."** Know that button's location.

---

## Part 1 — The demo

### Scene 1 — The problem, in one sentence (0:00–0:45)

Talk over a still of the board.

> "Every company I've worked at has the same gap. The exec team has a roadmap
> in one tool. Product has requirements in another. Engineering has tickets in a
> third. They describe the same work and they disagree within a week. Nobody is
> lying — the tools just don't share a source of truth.
>
> This is Conexus. One record per piece of work, and four different views of it."

### Scene 2 — The executive view (0:45–2:30)

Signed in as **Dana**.

1. Land on `/board`. Point out five columns, six items — deliberately ordinary.
2. Open **"SSO for enterprise customers."**
3. Note that it opened on the **Roadmap** tab. *"I didn't click that. Dana is an
   executive, so this is where she lands."*
4. Read the Roadmap fields aloud — timeframe, business goal, and especially the
   *why*: **"Four of our last six enterprise losses named 'no SSO' as a blocker."**

> "That's the executive altitude. Not a ticket. Not story points. Why we're
> spending money on this, and when it lands."

5. Click **PRD**, then **Spec**. Scroll briefly.

> "Same item. She can read every level — nothing is hidden from her. But watch:"

6. On the Spec tab, point at the greyed fields and the lock notice: *"Read-only
   for your role. Only Engineers and Designers can edit this view."*

> "She can read the spec. She can't quietly rewrite it. That's the deal."

### Scene 3 — The product manager view (2:30–6:00)

Switch to **Priya**.

1. Open **"Bulk CSV import for contacts"** — it has roadmap context and an
   empty PRD. *"This is the state most work is actually in: someone wants it,
   nobody has written it down."*
2. Note it opened on **PRD**, not Roadmap. *"Same item, different door."*
3. Click **Build PRD**.
4. Answer the first question naturally. Suggested:
   > "Sales ops. They get contact lists from events as spreadsheets and retype
   > them by hand, which takes about two days after each conference."
5. Answer the second — mention something you want to see survive into the PRD:
   > "Success is a rep uploading a 500-row file and it landing correctly in under
   > a minute, with bad rows reported rather than silently dropped."
6. **Click "Finish early."** *"It'd normally ask a couple more. I'm impatient."*
7. When the review panel opens — **slow down, this is the most important moment
   in the demo:**

> "It has not saved anything. This is a proposal. Every field is here side by
> side with what's already there, and I accept or skip them one at a time."

8. Skip one field to prove the point, then **Apply**.
9. Show the populated PRD fields. Point out language traceable to what you said.

> "Note what it did *not* do. Where I didn't answer something, it says so instead
> of inventing a decision. That's the difference between a drafting tool and a
> plausible-sounding liability."

### Scene 4 — The engineer view (6:00–9:00)

Switch to **Marcus**.

1. Open the same **"Bulk CSV import"** item. It opens on **Spec**.
2. Click **Generate spec**. While it runs (~30–60s), talk:

> "It's reading the PRD Priya just wrote. Engineers aren't re-deriving intent
> from a two-line ticket — the reasoning is already attached to the item."

3. When the preview opens, point out the acceptance criteria are *checkable*,
   and apply it.
4. Open the **History** tab.

> "Every change on this item: what changed, from what to what, who did it, and
> why. The PRD says agent-written, approved by Priya. Nothing here is a mystery
> in six months."

### Scene 5 — Build execution (9:00–12:00)

Still as **Marcus**. This is the scene engineers came for.

1. On the Spec tab, show the **Build** panel and the linked repository.
2. Click **Build this**. Show the item flip to **In Progress** and the status
   badge go **Queued → Running**.

> "That's a coding agent, in a sandbox, with the repo checked out and this
> item's spec as its brief. It takes about ten minutes, so —"

3. **Cut.** Open **"Add a formatBytes helper"** (In Review).
4. Show status **Succeeded**, the branch name, and the output summary.
5. Click through to the pull request. **Show the actual diff on GitHub.**

> "Real branch, real PR, real tests. And it flagged two decisions it wasn't
> willing to make alone — whether a kilobyte is 1000 or 1024, and how to format
> trailing zeros — rather than picking silently."

6. Back in Conexus, open **History** on that item.

> "It moved itself to In Progress when the build started, and to In Review when
> the PR opened. Both recorded, both attributed to the agent, with reasons.
> Nobody dragged a card."

### Scene 6 — The chat, and the close (12:00–13:30)

1. In the chat panel on any item, type:
   > `What's the current status and priority of this item?`
   Show it answer from context.
2. Then:
   > `This is blocking our enterprise deal — bump it to high priority.`
   Show the change apply and the confirmation.
3. Open **History** and show that change logged with your own sentence as the
   reason.
4. **The closing beat.** As Priya (a PM), type:
   > `Rewrite the spec's technical approach to use WebAuthn instead.`
   It refuses: *a Product Manager cannot edit the spec view* — and tells you who
   can.

> "The agent works on your behalf, with exactly your permissions. Chat isn't a
> back door around the rules."

Close on the board.

> "One record. Four views. Every change attributed. And when the spec is good
> enough, the same record becomes a pull request."

---

## Part 2 — What each room will push back on

Answer these honestly. The gaps below are real, and engineers in particular will
find them within a minute of getting their hands on it.

### Executives

| They'll ask | Answer |
|---|---|
| "What does this replace, and what does it cost?" | Today it replaces the *tracking* layer. Cost is a Postgres database plus per-run model usage — a build run is cents, not a seat licence. Be concrete: Jira Premium is roughly $16/user/month; 200 people is ~$38k/year before the Confluence and add-on sprawl that usually follows. |
| "Where's my portfolio view?" | Not built. Today it's one board. Cross-project rollup is the first thing on the roadmap, and it's the honest answer to "can we run the company on this." |
| "How do I know the AI isn't making things up?" | Show History again. Every agent change is attributed and reversible by editing. And the generated PRD explicitly flags what it *didn't* know. |

### Product managers

| They'll ask | Answer |
|---|---|
| "Does it replace my PRD doc?" | It replaces the copy that goes stale. The PRD lives on the item, so the spec and the build brief read from the same text. |
| "What if the interview writes something wrong?" | Nothing saves without you accepting it, field by field. Then it's an ordinary text field you edit. |
| "Sprints, estimates, velocity?" | Not built, and worth being blunt: this is currently a flow tool, not a scrum tool. If your teams live on sprint ceremonies, that's a gap to close before switching. |

### Engineers

| They'll ask | Answer |
|---|---|
| "Does the agent actually write usable code?" | Show the diff. It matched the repo's existing conventions and wrote tests. It also refused to guess on two ambiguous decisions. Then say the true thing: it's good at well-specified, bounded work. It is not going to do your migration. |
| "What happens when it's wrong?" | It opens a PR. Your review process is unchanged — nothing merges itself, by design. |
| "Who can change my spec?" | Nobody outside Engineering and Design, including through the agent. Demonstrated live in Scene 6. |
| "Where are the integrations — CI, Slack, GitHub issues?" | None yet. That's the honest answer, and the biggest practical gap versus Jira. |
| "Wait — can Dana trigger a build?" | Yes, today. Altitude gating covers *content*; board mechanics and builds are open to any signed-in user. Someone will notice this, so don't pretend otherwise — say it's an open design question and ask the room whether triggering a build should be engineering-only. It's a two-line change if the answer is yes. |

---

## Part 3 — The vision, staged honestly

Show this as three horizons, not a wish list. Credibility comes from the "not
yet" column being specific.

**Horizon 1 — Make it liveable (the gaps above)**
Cross-project portfolio view · search · notifications · Slack and CI hooks ·
saved filters · sprints if your teams need them.

**Horizon 2 — The record earns its keep**
Every item now carries intent, decisions, and the diff that resulted. That makes
things possible that a ticket tracker cannot do:
- *"What did we ship last quarter, and why?"* answered from the record, not
  reconstructed by a human.
- *"This decision was reversed twice — show me why"* — the history is already
  structured for it.
- Onboarding that reads the trail instead of interrupting a senior engineer.

**Horizon 3 — More of the work happens on the record**
Multiple build agents in parallel; the agent proposing spec changes when a PR
review contradicts the spec; roadmap drift detection when what shipped stops
matching what was promised.

---

## Part 4 — The Jira argument, without overclaiming

**Where this is genuinely better today**

1. **One record, not four tools.** Roadmap, PRD, and spec are views of the same
   row. They cannot drift, because there is nothing to sync.
2. **The "why" survives.** Jira's history tells you a field changed. This tells
   you what it was, what it became, who did it, and the sentence that motivated
   it.
3. **AI is native, not bolted on.** It reads the item's real context and writes
   into its real fields, with role permissions enforced server-side.
4. **The record produces the work.** No other tracker turns a ticket into a pull
   request.
5. **Cost shape.** Per-seat pricing punishes you for including people. This
   doesn't have seats.

**Where Jira still wins, and you should say so**

Portfolio and cross-project reporting · the integration ecosystem · sprint and
agile ceremony support · granular permission schemes · compliance and audit
tooling · search at scale · mobile · a decade of organisational muscle memory.

**The honest pitch**

> "This isn't Jira parity. It's a bet that the expensive problem isn't tracking
> tickets — it's that the reason for the work gets lost between the people who
> decide it, the people who specify it, and the people who build it. We'd start
> with one team and one repository, and measure whether engineers stop asking
> 'why are we building this?'"

That framing survives contact with a skeptical engineer. "We replace Jira" does
not.

---

## Appendix — if something breaks on camera

| Symptom | Cause | What to say |
|---|---|---|
| Generation hangs past ~90s | Model latency | Cut. It's not reliably fast enough to wait on camera. |
| Build stuck on Running | Sync only advances while the panel is open | Keep the tab focused. Known gap — webhooks are the fix. |
| "A build is already running" | Concurrency guard | That's deliberate: one run per item. |
| Chat asks a clarifying question instead of acting | It won't act on vague instructions | Good moment to praise — then restate directly. |
