# Milestone 3 — PRD & Spec authoring

## What's new in the app

- **Product Managers can build a PRD by answering questions.** A "Build PRD" button on the PRD tab starts a short guided interview — one question at a time, with a "Finish early" option — and drafts all five PRD fields from your answers.
- **Engineers and Designers can generate a spec.** "Generate spec" writes the technical approach and acceptance criteria from the work item's PRD.
- **Designers can generate design notes.** A separate "Generate design notes" button covers design-system pieces, screens and their states, and sample data.
- **Nothing is ever overwritten without you seeing it first.** Generated content opens in a review panel showing the proposed text beside whatever is already there, with the old version struck through. You accept or skip each field individually, and only accepted fields are saved.
- **Generation respects roles.** Only PMs see the PRD builder; only Engineers and Designers see the spec buttons. Everyone can still read the results.
- **Everything generated stays editable.** Applied content lands in the normal fields and can be edited by hand afterwards.
- **The app runs without an API key.** Without one, generation returns obviously-labelled placeholder text so the feature is usable in development.

## What was built

**AI layer** (`src/lib/ai/`)
- `client.ts` — `generate()` wraps `client.messages.parse()` with `output_config.format` for schema-validated JSON. Model **`claude-opus-5`**, `thinking: { type: "adaptive" }`, `max_tokens: 16000`. Handles `stop_reason: "refusal"` and missing `parsed_output` explicitly.
- `schemas.ts` — flat Zod output schemas: `interviewTurn`, `prdDraft`, `specDraft`, `designNotesDraft`, plus the `InterviewMessage` type.
- `prompts.ts` — system prompts and context builders (`workItemBrief`, `prdBrief`).
- `authoring.ts` — the four generation functions and their stub payloads.

**Server actions** (added to `src/app/(app)/work-items/[id]/actions.ts`) — `continueInterview`, `synthesizePrd`, `generateSpec`, `generateDesignNotes`, plus a private `loadContext()`. All four are gated by the existing `requireAltitudeAccess()`.

**UI** (`src/app/(app)/work-items/[id]/`)
- `prd-interview-dialog.tsx` — the guided interview.
- `generation-preview.tsx` — the accept/skip diff panel, shared by all three flows.
- `altitude-form.tsx` — gained a generation button row and the preview wiring.

**Config** — `ANTHROPIC_API_KEY` added to `.env.example` and the README env table. Dependency: `@anthropic-ai/sdk`.

## Decisions made during implementation

1. **Generation never writes.** The four generation actions return a draft and nothing else; applying a draft goes through the existing `updatePrd` / `updateSpec` actions. There is still exactly **one** write path per altitude, already validated and role-gated. This is what makes the preview safe rather than an extra thing to keep in sync.

2. **A preview, not an overwrite.** Confirmed with the user. Version history and approval workflows are explicitly out of scope for this milestone, so an overwrite would be unrecoverable. The preview shows current vs. proposed per field with a per-field accept toggle, and only accepted fields are sent.

3. **The interview is a real multi-turn conversation.** Confirmed with the user. Two model calls, not one: each turn returns `{ isComplete, message }`, and a separate synthesis call turns the finished transcript into the five PRD fields. Two flat schemas beat one schema with optional branches — structured outputs support neither unions nor recursion.

4. **The transcript is not persisted.** It lives in React state for the life of the dialog. Persistent conversations are milestone 4's job; building message storage twice would have been wasted work.

5. **Agent OS / Design OS conventions are prompt guidance, and are *approximate*.** Neither repo publishes a concrete spec or design-notes template — both are process-based, with the real detail behind buildermethods.com. Rather than invent a template and label it "Agent OS format", the prompts encode what those projects actually state publicly: Agent OS shapes specs against a codebase's existing standards and patterns; Design OS moves design system → screens and states → sample data. **The field structure comes from the Conexus PRD, not from either project.** Worth tightening against the full docs when someone has access.

6. **The dev stub is the verification seam.** With no `ANTHROPIC_API_KEY`, `generate()` returns stub content in development and throws in production — the same shape as the Resend fallback from milestone 1. Stub text is prefixed `[stub — set ANTHROPIC_API_KEY for real output]` so it cannot be mistaken for model output.

7. **`requireAltitudeAccess()` now returns a tagged union.** It previously returned `{ error }` | `{ user }`, and callers used `"error" in access`. That does not narrow — TypeScript infers an optional `error?: undefined` on the success branch, so the `in` check can't exclude it, and the new actions' return types silently absorbed the user object. It now returns `{ ok: false, error }` | `{ ok: true, user }` and every call site uses `!access.ok`. Behaviour is unchanged; the four milestone 2 actions were updated to match.

8. **No streaming.** Output lands in a review panel rather than being read as it arrives, so a spinner is sufficient. Revisit if generation gets slow enough to feel broken.

## What the next milestone needs to know

- **Milestone 4's chat agent should reuse `src/lib/ai/client.ts`.** `generate()` already handles the key-missing fallback, refusals, and empty output. A conversational endpoint will additionally want streaming — add it alongside, don't replace the structured path.
- **`InterviewMessage` (`src/lib/ai/schemas.ts`) is the shape to persist** if the chat panel wants to store the PRD interview rather than discard it. There is currently no `chat_message` table — milestone 4 introduces one per the PRD's data model.
- **Use `!access.ok`, not `"error" in access`,** with `requireAltitudeAccess()`.
- **The change history log (milestone 4) should record generated writes.** Applied drafts currently go through `updatePrd`/`updateSpec` like any manual edit and are indistinguishable from hand-typed content. If history should say "written by the agent", that attribution needs to be threaded through those actions — nothing captures it today.
- **`loadContext()` in the work-item actions file** is the single place that assembles work-item + roadmap + PRD context for prompts. Extend it rather than re-querying.

## Deviations from the PRD

- **The PRD's out-of-scope list is fully respected** — no version history, no approval workflow, no export, no Figma or mockups.
- **The Agent OS / Design OS grounding is weaker than the PRD implies** (decision 5). The PRD says the spec is generated "using Agent OS conventions"; what shipped is generation guided by those projects' published principles, not a faithful implementation of a documented template — because no such template is public.
- Everything in "What gets built" was delivered. Nothing was cut.

## Verification

Verified in headless Chrome against the dev server on a clean database — 13 checks, all passing, no console errors:

| Done-when criterion | Result |
| --- | --- |
| PM runs the guided PRD builder | Pass — questions asked one at a time, interview reaches completion |
| A readable PRD appears on the PRD tab | Pass — draft previewed, applied, and persisted across reload |
| Engineer generates a spec from the PRD | Pass — approach + acceptance criteria written |
| Designer/Engineer generates design notes | Pass — design notes written |
| Generated content is editable afterward | Pass — lands in the normal editable fields |
| Subject to milestone 2 role rights | Pass — see below |

**Preview is non-destructive.** A PRD field was hand-filled with `ORIGINAL HAND-WRITTEN TEXT`, then a generated draft was applied with that one field skipped. After reload the hand-written text was intact and the accepted fields were written — confirming per-field control works and generation cannot silently clobber existing work.

**Role gating holds server-side, tested by bypassing the UI.** Generation actions were POSTed directly with mismatched-role sessions:

- Engineer → `synthesizePrd` → `{"error":"Only Product Managers can edit this view"}`
- Product Manager → `generateSpec` → `{"error":"Only Engineers and Designers can edit this view"}`
- Engineer → `generateSpec` → succeeded (control)

`npm run lint`, `npx tsc --noEmit`, and `npm run build` all pass clean. Test data was deleted; the dev database is empty.
## Verified against the live API (2026-08-11)

Re-run with a real `ANTHROPIC_API_KEY`. Everything previously listed as unverified now passes:

- **Live `messages.parse()` round-trip works.** Real requests to `claude-opus-5` return `parsed_output` matching each schema — the guided interview, the PRD synthesis, spec generation, and design notes.
- **Zod v4 + `zodOutputFormat` confirmed working** end to end, not just at the type level.
- **Prompt quality is good.** The interview asked targeted questions ("What's the bigger pain today — the sheer time spent on manual entry, or the errors it creates?") rather than generic ones, and the synthesised PRD demonstrably used the interviewee's answers.
- **The "don't invent detail" instruction in `SYNTHESIS_SYSTEM` works.** Where a question went unanswered, the PRD said so — *"Behaviour for a row that matches an existing contact was asked about twice and not answered"* — instead of fabricating a decision.
- **The Agent OS framing lands.** The generated spec opened by proposing an approach that "mirrors how the codebase already handles user-initiated work that outlives a request", which is the standards-driven shaping the prompt asks for.

**One tuning note.** The interview did not set `isComplete` within five questions — the test ran out of scripted answers while the agent was still going. `INTERVIEW_SYSTEM` caps it at six, so it likely stops there, but if interviews feel long in practice, lower that cap or strengthen the "as soon as you could write a useful PRD" instruction.
