import { generate } from "@/lib/ai/client"
import {
  DESIGN_SYSTEM,
  INTERVIEW_SYSTEM,
  PRODUCT_BRIEF_SYSTEM,
  ROADMAP_SYNTHESIS_SYSTEM,
  SPEC_SYSTEM,
  SYNTHESIS_SYSTEM,
  designNotesPrompt,
  interviewPrompt,
  productBriefPrompt,
  roadmapSynthesisPrompt,
  specPrompt,
  synthesisPrompt,
  type WorkItemContext,
} from "@/lib/ai/prompts"
import {
  designNotesDraftSchema,
  interviewTurnSchema,
  prdDraftSchema,
  productBriefSchema,
  roadmapDraftSchema,
  specDraftSchema,
  type InterviewMessage,
} from "@/lib/ai/schemas"

/**
 * Stub content is labelled so it can never be mistaken for model output when
 * running without an API key.
 */
const STUB = "[stub — set ANTHROPIC_API_KEY for real output]"

const STUB_QUESTIONS = [
  "What problem does this solve, and who feels it today?",
  "What does success look like — how would you know this worked?",
  "What is deliberately not part of this piece of work?",
]

export async function nextInterviewTurn(
  ctx: WorkItemContext,
  transcript: InterviewMessage[]
) {
  const asked = transcript.filter((m) => m.role === "assistant").length

  return generate({
    schema: interviewTurnSchema,
    system: INTERVIEW_SYSTEM,
    prompt: interviewPrompt(ctx, transcript),
    stub:
      asked >= STUB_QUESTIONS.length
        ? { isComplete: true, message: `Thanks — that's enough to draft it. ${STUB}` }
        : { isComplete: false, message: `${STUB_QUESTIONS[asked]} ${STUB}` },
  })
}

export async function synthesizeRoadmapDraft(
  ctx: WorkItemContext,
  transcript: InterviewMessage[]
) {
  return generate({
    schema: roadmapDraftSchema,
    system: ROADMAP_SYNTHESIS_SYSTEM,
    prompt: roadmapSynthesisPrompt(ctx, transcript),
    stub: {
      targetTimeframe: `${STUB} Next quarter`,
      businessGoal: `${STUB} Business goal for "${ctx.title}".`,
      why: `${STUB} Why "${ctx.title}" matters.`,
    },
  })
}

export async function synthesizePrdDraft(
  ctx: WorkItemContext,
  transcript: InterviewMessage[]
) {
  const answers = transcript
    .filter((m) => m.role === "user")
    .map((m) => m.content)
    .join(" / ")

  return generate({
    schema: prdDraftSchema,
    system: SYNTHESIS_SYSTEM,
    prompt: synthesisPrompt(ctx, transcript),
    stub: {
      problemStatement: `${STUB} Problem for "${ctx.title}". From the interview: ${answers}`,
      goals: `${STUB} Goals for "${ctx.title}".`,
      inScope: `${STUB} In scope for "${ctx.title}".`,
      outOfScope: `${STUB} Out of scope for "${ctx.title}".`,
      successCriteria: `${STUB} Success criteria for "${ctx.title}".`,
    },
  })
}

export async function generateSpecDraft(ctx: WorkItemContext) {
  return generate({
    schema: specDraftSchema,
    system: SPEC_SYSTEM,
    prompt: specPrompt(ctx),
    stub: {
      technicalApproach: `${STUB} Technical approach for "${ctx.title}".`,
      acceptanceCriteria: `${STUB} Acceptance criteria for "${ctx.title}".`,
    },
  })
}

export async function generateDesignNotesDraft(ctx: WorkItemContext) {
  return generate({
    schema: designNotesDraftSchema,
    system: DESIGN_SYSTEM,
    prompt: designNotesPrompt(ctx),
    stub: {
      designNotes: `${STUB} Design notes for "${ctx.title}".`,
    },
  })
}

export async function draftProductBrief(
  files: { path: string; content: string }[]
) {
  return generate({
    schema: productBriefSchema,
    system: PRODUCT_BRIEF_SYSTEM,
    prompt: productBriefPrompt(files),
    stub: {
      productName: `${STUB} What this product is.`,
      productAudience: `${STUB} Who it is for.`,
      productStack: `${STUB} Read from ${files.map((f) => f.path).join(", ") || "no files"}.`,
      productConventions: `${STUB} Conventions and constraints.`,
    },
  })
}
