import { z } from "zod"

/**
 * Output schemas for structured generation. Kept flat and free of unions or
 * recursion — the structured-outputs API does not support either.
 */

export const interviewTurnSchema = z.object({
  isComplete: z
    .boolean()
    .describe("True once enough has been gathered to write the PRD."),
  message: z
    .string()
    .describe(
      "The next question to ask, or a short closing remark when isComplete is true."
    ),
})

export const productBriefSchema = z.object({
  productName: z.string(),
  productAudience: z.string(),
  productStack: z.string(),
  productConventions: z.string(),
})

export const roadmapDraftSchema = z.object({
  targetTimeframe: z.string(),
  businessGoal: z.string(),
  why: z.string(),
})

export const prdDraftSchema = z.object({
  problemStatement: z.string(),
  goals: z.string(),
  inScope: z.string(),
  outOfScope: z.string(),
  successCriteria: z.string(),
})

export const specDraftSchema = z.object({
  technicalApproach: z.string(),
  acceptanceCriteria: z.string(),
})

export const designNotesDraftSchema = z.object({
  designNotes: z.string(),
})

export type InterviewTurn = z.infer<typeof interviewTurnSchema>
export type RoadmapDraft = z.infer<typeof roadmapDraftSchema>
export type ProductBriefDraft = z.infer<typeof productBriefSchema>
export type PrdDraft = z.infer<typeof prdDraftSchema>
export type SpecDraft = z.infer<typeof specDraftSchema>
export type DesignNotesDraft = z.infer<typeof designNotesDraftSchema>

/** One exchange in the PRD-builder interview. */
export type InterviewMessage = {
  role: "assistant" | "user"
  content: string
}
