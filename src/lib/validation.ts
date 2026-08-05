import { z } from "zod"

import { ROLE_VALUES } from "@/lib/roles"
import { PRIORITY_VALUES, STATUS_VALUES } from "@/lib/work-items"

export const signupSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  email: z.email("Enter a valid email"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  // Optional because Solo mode never asks — signUp resolves it server-side so
  // the client can't choose a role that isn't offered.
  role: z.enum(ROLE_VALUES).optional(),
  /** Only present on first run, where it sets the workspace mode. */
  mode: z.enum(["team", "solo"]).optional(),
})

export const loginSchema = z.object({
  email: z.email("Enter a valid email"),
  password: z.string().min(1, "Password is required"),
})

export const forgotPasswordSchema = z.object({
  email: z.email("Enter a valid email"),
})

export const resetPasswordSchema = z
  .object({
    token: z.string().min(1),
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string().min(1, "Confirm your password"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  })

export const profileSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  image: z.union([z.url("Enter a valid image URL"), z.literal("")]),
  // Optional because Solo mode hides the role selector; the action keeps the
  // stored role unchanged when it is absent.
  role: z.enum(ROLE_VALUES).optional(),
})

/**
 * Empty strings are allowed and become NULL in the database.
 *
 * The cap is a sanity bound, not a product limit — these are `text` columns.
 * It started at 5,000 and silently rejected real generated specs, which run
 * well past that when the interview has given the model enough to work with.
 */
const optionalText = z.string().trim().max(50_000)

export const productBriefSchema = z.object({
  productName: optionalText,
  productAudience: optionalText,
  productStack: optionalText,
  productConventions: optionalText,
})

export const createWorkItemSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(200),
  summary: z.string().trim().max(500),
  priority: z.enum(PRIORITY_VALUES, { message: "Select a priority" }),
  ownerId: z.union([z.uuid(), z.literal("")]),
})

export const updateWorkItemCoreSchema = createWorkItemSchema.extend({
  id: z.uuid(),
})

export const moveWorkItemSchema = z.object({
  id: z.uuid(),
  status: z.enum(STATUS_VALUES),
  orderedIds: z.array(z.uuid()),
})

export const roadmapSchema = z.object({
  workItemId: z.uuid(),
  targetTimeframe: optionalText,
  businessGoal: optionalText,
  why: optionalText,
})

export const prdSchema = z.object({
  workItemId: z.uuid(),
  problemStatement: optionalText,
  goals: optionalText,
  inScope: optionalText,
  outOfScope: optionalText,
  successCriteria: optionalText,
})

export const specSchema = z.object({
  workItemId: z.uuid(),
  technicalApproach: optionalText,
  designNotes: optionalText,
  acceptanceCriteria: optionalText,
})

export type SignupInput = z.infer<typeof signupSchema>
export type LoginInput = z.infer<typeof loginSchema>
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>
export type ProfileInput = z.infer<typeof profileSchema>
export type ProductBriefInput = z.infer<typeof productBriefSchema>
export type CreateWorkItemInput = z.infer<typeof createWorkItemSchema>
export type UpdateWorkItemCoreInput = z.infer<typeof updateWorkItemCoreSchema>
export type RoadmapInput = z.infer<typeof roadmapSchema>
export type PrdInput = z.infer<typeof prdSchema>
export type SpecInput = z.infer<typeof specSchema>
