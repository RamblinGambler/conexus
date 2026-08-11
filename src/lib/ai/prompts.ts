import type { InterviewMessage } from "@/lib/ai/schemas"

/**
 * The workspace product brief. Held once and read by every generation so the
 * operator never restates it per work item.
 */
export type ProductBrief = {
  productName: string | null
  productAudience: string | null
  productStack: string | null
  productConventions: string | null
}

export type ProductPart = keyof ProductBrief

export type WorkItemContext = {
  product: ProductBrief | null
  title: string
  summary: string | null
  roadmap: {
    targetTimeframe: string | null
    businessGoal: string | null
    why: string | null
  } | null
  prd: {
    problemStatement: string | null
    goals: string | null
    inScope: string | null
    outOfScope: string | null
    successCriteria: string | null
  } | null
}

function section(label: string, value: string | null | undefined) {
  return value?.trim() ? `${label}: ${value.trim()}` : null
}

const PRODUCT_LABELS: Record<ProductPart, string> = {
  productName: "What the product is",
  productAudience: "Who it is for",
  productStack: "Built with",
  productConventions: "Conventions and constraints",
}

/**
 * Renders only the requested parts of the brief, and renders nothing at all
 * when they are empty — an unset brief must add no noise to the prompt.
 */
export function productSection(
  product: ProductBrief | null | undefined,
  parts: ProductPart[]
) {
  if (!product) return null

  const lines = parts
    .map((part) => section(PRODUCT_LABELS[part], product[part]))
    .filter(Boolean)

  if (lines.length === 0) return null
  return `ABOUT THIS PRODUCT\n${lines.join("\n")}`
}

/** Joins prompt blocks, dropping the ones that rendered empty. */
function blocks(...parts: (string | null)[]) {
  return parts.filter((p) => p !== null && p !== "").join("\n\n")
}

export function workItemBrief(ctx: WorkItemContext) {
  return [
    section("Title", ctx.title),
    section("Summary", ctx.summary),
    section("Target timeframe", ctx.roadmap?.targetTimeframe),
    section("Business goal", ctx.roadmap?.businessGoal),
    section("Why this matters", ctx.roadmap?.why),
  ]
    .filter(Boolean)
    .join("\n")
}

export function prdBrief(ctx: WorkItemContext) {
  return [
    section("Problem statement", ctx.prd?.problemStatement),
    section("Goals", ctx.prd?.goals),
    section("In scope", ctx.prd?.inScope),
    section("Out of scope", ctx.prd?.outOfScope),
    section("Success criteria", ctx.prd?.successCriteria),
  ]
    .filter(Boolean)
    .join("\n")
}

export const INTERVIEW_SYSTEM = `You are interviewing a product manager to write a product requirements document for one piece of work.

Ask one focused question at a time. Work toward covering the problem being solved, the goals, what is in and out of scope, and how success will be measured — but follow the conversation rather than reading from a fixed list, and skip anything the context already answers.

Keep questions short and concrete. Prefer "which of these two is the real problem?" over "tell me about your problem space". Do not ask more than six questions in total; set isComplete to true as soon as you could write a useful PRD, even if some detail is missing.`

export function interviewPrompt(
  ctx: WorkItemContext,
  transcript: InterviewMessage[]
) {
  const history = transcript.length
    ? transcript
        .map((m) => `${m.role === "assistant" ? "You" : "PM"}: ${m.content}`)
        .join("\n")
    : "(no questions asked yet)"

  return blocks(
    productSection(ctx.product, ["productName", "productAudience"]),
    `Work item:\n${workItemBrief(ctx)}`,
    `Interview so far:\n${history}`,
    "Ask your next question, or set isComplete if you have enough to write the PRD."
  )
}

export const ROADMAP_SYNTHESIS_SYSTEM = `You write the executive-altitude view of a piece of work from an interview transcript.

This is the view someone reads to decide whether the work is worth doing, not how it will be built. Keep it to the business case.

- Target timeframe: a quarter or rough range. If the interview gave no signal, say so plainly rather than inventing a date.
- Business goal: the outcome this serves, in the language a leadership team would use.
- Why this matters: the concrete evidence or cost that makes this worth doing now. Prefer specifics the interview actually gave you over generic value statements.

Two or three sentences per field. No headings.`

export function roadmapSynthesisPrompt(
  ctx: WorkItemContext,
  transcript: InterviewMessage[]
) {
  return blocks(
    productSection(ctx.product, ["productName", "productAudience"]),
    `Work item:\n${workItemBrief(ctx)}`,
    `Interview transcript:\n${transcript.map((m) => `${m.role === "assistant" ? "Interviewer" : "Operator"}: ${m.content}`).join("\n")}`,
    "Write the roadmap view."
  )
}

export const SYNTHESIS_SYSTEM = `You write product requirements documents from an interview transcript.

Fill every field. Write plainly and specifically — a reader who missed the interview should understand what is being built and why. Use the PM's own words for domain terms. Where the interview did not cover something, write a short, clearly-provisional line rather than inventing detail.

Format each field as prose or a short bullet list. Do not add headings — the fields are already labelled in the UI.`

export function synthesisPrompt(
  ctx: WorkItemContext,
  transcript: InterviewMessage[]
) {
  return blocks(
    productSection(ctx.product, ["productName", "productAudience"]),
    `Work item:\n${workItemBrief(ctx)}`,
    `Interview transcript:\n${transcript.map((m) => `${m.role === "assistant" ? "Interviewer" : "PM"}: ${m.content}`).join("\n")}`,
    "Write the PRD."
  )
}

/**
 * Agent OS shapes specs against a codebase's existing standards and patterns
 * rather than against a fixed template, so this prompt asks for an approach
 * that names those patterns instead of prescribing section headings.
 */
export const SPEC_SYSTEM = `You write technical specs for engineers, in the Agent OS style: a spec is a plan shaped by the standards and patterns the codebase already uses, not a generic template.

For the technical approach: describe how this should be built, calling out the existing conventions it should follow and the places it touches. Flag decisions that need a human to make them rather than guessing.

For acceptance criteria: write checkable statements — a reviewer should be able to confirm each one is true or false. Cover the main path and the failure cases that matter.

Write plainly, no headings.`

export function specPrompt(ctx: WorkItemContext) {
  return blocks(
    productSection(ctx.product, [
      "productName",
      "productStack",
      "productConventions",
    ]),
    `Work item:\n${workItemBrief(ctx)}`,
    `Product requirements:\n${prdBrief(ctx) || "(no PRD written yet — infer what you can from the work item)"}`,
    "Write the technical approach and acceptance criteria."
  )
}

/**
 * Design OS moves design system -> screens and states -> sample data, so the
 * notes follow that arc.
 */
export const DESIGN_SYSTEM = `You write design notes for designers, in the Design OS style: work from the design system outward to screens, then to the data those screens display.

Cover, as far as the work allows: which design-system pieces this uses or needs, the screens and the states each one has (empty, loading, error, populated), and what realistic sample data looks like. Note anything that will need a design decision before build.

Write plainly, no headings. Do not describe visual styling in detail — this is a written note, not a mockup.`

export function designNotesPrompt(ctx: WorkItemContext) {
  return blocks(
    productSection(ctx.product, [
      "productName",
      "productAudience",
      "productConventions",
    ]),
    `Work item:\n${workItemBrief(ctx)}`,
    `Product requirements:\n${prdBrief(ctx) || "(no PRD written yet — infer what you can from the work item)"}`,
    "Write the design notes."
  )
}

export const PRODUCT_BRIEF_SYSTEM = `You write a short product brief from a repository's own files, for a tool that will use it as standing context on every piece of work.

- What the product is: a couple of sentences someone outside the team would understand. Not a feature list.
- Who it is for: the actual users and what they are trying to do.
- Built with: the languages, frameworks, database, and notable libraries you can see evidence for. Name versions where the files give them.
- Conventions and constraints: how code is written here — testing approach, file layout, naming, error handling, anything the repository states explicitly about how to contribute.

Work only from what the files show. Where they are silent, say so plainly in that field rather than guessing — a brief that invents conventions is worse than one that admits a gap, because everything generated later inherits it.`

export function productBriefPrompt(files: { path: string; content: string }[]) {
  return `Repository files:

${files.map((f) => `--- ${f.path} ---\n${f.content}`).join("\n\n")}

Write the product brief.`
}
