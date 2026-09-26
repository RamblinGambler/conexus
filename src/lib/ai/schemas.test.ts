import { describe, expect, it } from "vitest"
import { z } from "zod"

import {
  designNotesDraftSchema,
  interviewTurnSchema,
  prdDraftSchema,
  productBriefSchema,
  roadmapDraftSchema,
  specDraftSchema,
} from "@/lib/ai/schemas"

/**
 * These schemas are the contract with the structured-outputs API: `generate()`
 * passes them through `zodOutputFormat` and returns `parsed_output` directly, so
 * a schema that drifts from what the UI reads surfaces as a runtime shape error
 * rather than a type error.
 *
 * The flatness check matters as much as the field checks — the API supports
 * neither unions nor recursion, so a nested or optional field added later would
 * fail at call time, not here.
 */

/**
 * Zod 4 types `.shape` values as `$ZodType`, which does not surface
 * `safeParse`. These schemas are all flat objects of leaf types, so reading the
 * shape as parseable types is accurate here.
 */
const shapeOf = (schema: unknown) =>
  (schema as { shape: Record<string, z.ZodType> }).shape

const schemas = {
  interviewTurn: interviewTurnSchema,
  productBrief: productBriefSchema,
  roadmapDraft: roadmapDraftSchema,
  prdDraft: prdDraftSchema,
  specDraft: specDraftSchema,
  designNotesDraft: designNotesDraftSchema,
} as const

const valid = {
  interviewTurn: { isComplete: false, message: "Who is this for?" },
  productBrief: {
    productName: "Conexus",
    productAudience: "Software teams",
    productStack: "Next.js, Postgres",
    productConventions: "Server actions for writes",
  },
  roadmapDraft: {
    targetTimeframe: "Q4",
    businessGoal: "Shorten planning cycles",
    why: "Roles duplicate the same work item today",
  },
  prdDraft: {
    problemStatement: "Plans drift from what ships",
    goals: "One record per work item",
    inScope: "Kanban board",
    outOfScope: "Native mobile",
    successCriteria: "Every item has an owner",
  },
  specDraft: {
    technicalApproach: "Drizzle with a one-to-one child table",
    acceptanceCriteria: "Editing the spec records a change entry",
  },
  designNotesDraft: { designNotes: "Two-column detail layout" },
} as const

describe("output schemas", () => {
  for (const [name, schema] of Object.entries(schemas)) {
    const fixture = valid[name as keyof typeof valid]

    it(`${name} accepts a complete object`, () => {
      expect(schema.parse(fixture)).toEqual(fixture)
    })

    it(`${name} rejects a missing required field`, () => {
      for (const key of Object.keys(fixture)) {
        const partial = { ...fixture } as Record<string, unknown>
        delete partial[key]
        expect(schema.safeParse(partial).success).toBe(false)
      }
    })

    it(`${name} declares every field as required`, () => {
      // Optional fields are not supported by the structured-outputs API.
      for (const field of Object.values(shapeOf(schema))) {
        expect(field.safeParse(undefined).success).toBe(false)
      }
    })
  }
})

describe("field types", () => {
  it("requires a boolean for interviewTurn.isComplete", () => {
    expect(
      interviewTurnSchema.safeParse({ isComplete: "yes", message: "hi" }).success
    ).toBe(false)
    expect(
      interviewTurnSchema.safeParse({ isComplete: true, message: "hi" }).success
    ).toBe(true)
  })

  it("rejects a non-string where prose is expected", () => {
    expect(
      prdDraftSchema.safeParse({ ...valid.prdDraft, goals: 42 }).success
    ).toBe(false)
    expect(
      specDraftSchema.safeParse({ ...valid.specDraft, technicalApproach: null })
        .success
    ).toBe(false)
  })

  it("rejects null in place of an empty string", () => {
    // The API returns "" for a field it has nothing to say about, never null.
    expect(
      designNotesDraftSchema.safeParse({ designNotes: null }).success
    ).toBe(false)
    expect(designNotesDraftSchema.safeParse({ designNotes: "" }).success).toBe(
      true
    )
  })
})

describe("shape stays flat", () => {
  it("uses only string or boolean fields", () => {
    // Unions and recursion are unsupported; nesting is what would introduce
    // them by accident.
    for (const [name, schema] of Object.entries(schemas)) {
      for (const [field, def] of Object.entries(shapeOf(schema))) {
        const ok =
          def.safeParse("a string").success || def.safeParse(true).success
        expect(ok, `${name}.${field} should be a string or boolean`).toBe(true)
      }
    }
  })

  it("keeps the PRD schema at the five fields the form reads", () => {
    expect(Object.keys(prdDraftSchema.shape).sort()).toEqual([
      "goals",
      "inScope",
      "outOfScope",
      "problemStatement",
      "successCriteria",
    ])
  })

  it("keeps the roadmap schema at the three fields the form reads", () => {
    expect(Object.keys(roadmapDraftSchema.shape).sort()).toEqual([
      "businessGoal",
      "targetTimeframe",
      "why",
    ])
  })
})
