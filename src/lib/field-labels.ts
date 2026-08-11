/**
 * Display names for the fields that appear in change history.
 *
 * Kept separate from `changes.ts` because the history UI renders inside a
 * client component — importing it from the module that talks to the database
 * would pull the Postgres driver into the browser bundle.
 */
export const FIELD_LABELS: Record<string, string> = {
  title: "Title",
  summary: "Summary",
  status: "Status",
  priority: "Priority",
  ownerId: "Owner",
  targetTimeframe: "Target timeframe",
  businessGoal: "Business goal",
  why: "Why this matters",
  problemStatement: "Problem statement",
  goals: "Goals",
  inScope: "In scope",
  outOfScope: "Out of scope",
  successCriteria: "Success criteria",
  technicalApproach: "Technical approach",
  designNotes: "Design notes",
  acceptanceCriteria: "Acceptance criteria",
}

export function fieldLabel(field: string) {
  return FIELD_LABELS[field] ?? field
}
