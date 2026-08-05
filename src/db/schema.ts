import { relations } from "drizzle-orm"
import {
  type AnyPgColumn,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core"
import type { AdapterAccountType } from "next-auth/adapters"

export const userRoleEnum = pgEnum("user_role", [
  "executive",
  "product_manager",
  "engineer",
  "designer",
])

export const users = pgTable("user", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name"),
  email: text("email").unique().notNull(),
  emailVerified: timestamp("email_verified", { mode: "date" }),
  passwordHash: text("password_hash"),
  role: userRoleEnum("role").notNull(),
  image: text("image"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
})

export const accounts = pgTable(
  "account",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").$type<AdapterAccountType>().notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("provider_account_id").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (account) => [
    primaryKey({ columns: [account.provider, account.providerAccountId] }),
  ]
)

export const sessions = pgTable("session", {
  sessionToken: text("session_token").primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { mode: "date" }).notNull(),
})

export const verificationTokens = pgTable(
  "verification_token",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { mode: "date" }).notNull(),
  },
  (vt) => [primaryKey({ columns: [vt.identifier, vt.token] })]
)

export const passwordResetTokens = pgTable("password_reset_token", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  token: text("token").unique().notNull(),
  expiresAt: timestamp("expires_at", { mode: "date" }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
})

export const workItemStatusEnum = pgEnum("work_item_status", [
  "planning",
  "ready",
  "in_progress",
  "in_review",
  "done",
])

export const workItemPriorityEnum = pgEnum("work_item_priority", [
  "low",
  "medium",
  "high",
])

export const workItems = pgTable("work_item", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull(),
  summary: text("summary"),
  status: workItemStatusEnum("status").notNull().default("planning"),
  priority: workItemPriorityEnum("priority").notNull().default("medium"),
  ownerId: uuid("owner_id").references(() => users.id, {
    onDelete: "set null",
  }),
  // Lazy reference: `repositories` is declared further down this file.
  repositoryId: uuid("repository_id").references(() => repositories.id, {
    onDelete: "set null",
  }),
  position: integer("position").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
})

/** Executive altitude — why this matters and when it lands. */
export const roadmapEntries = pgTable("roadmap_entry", {
  id: uuid("id").primaryKey().defaultRandom(),
  workItemId: uuid("work_item_id")
    .notNull()
    .unique()
    .references(() => workItems.id, { onDelete: "cascade" }),
  targetTimeframe: text("target_timeframe"),
  businessGoal: text("business_goal"),
  why: text("why"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
})

/** Product manager altitude — the problem and what success looks like. */
export const prds = pgTable("prd", {
  id: uuid("id").primaryKey().defaultRandom(),
  workItemId: uuid("work_item_id")
    .notNull()
    .unique()
    .references(() => workItems.id, { onDelete: "cascade" }),
  problemStatement: text("problem_statement"),
  goals: text("goals"),
  inScope: text("in_scope"),
  outOfScope: text("out_of_scope"),
  successCriteria: text("success_criteria"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
})

/** Engineer and designer altitude — how it gets built. */
export const specs = pgTable("spec", {
  id: uuid("id").primaryKey().defaultRandom(),
  workItemId: uuid("work_item_id")
    .notNull()
    .unique()
    .references(() => workItems.id, { onDelete: "cascade" }),
  technicalApproach: text("technical_approach"),
  designNotes: text("design_notes"),
  acceptanceCriteria: text("acceptance_criteria"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
})

export const workspaceModeEnum = pgEnum("workspace_mode", ["team", "solo"])

/**
 * Install-wide settings. Exactly one row, at a fixed id — see
 * `WORKSPACE_SETTINGS_ID` in src/lib/workspace.ts, which uses it plus
 * `onConflictDoNothing` so concurrent first reads can't create two rows.
 */
export const workspaceSettings = pgTable("workspace_settings", {
  id: uuid("id").primaryKey(),
  mode: workspaceModeEnum("mode").notNull().default("team"),
  defaultRepositoryId: uuid("default_repository_id").references(
    () => repositories.id,
    { onDelete: "set null" }
  ),
  /**
   * The product brief. Held once for the workspace and read by every
   * generation, so the operator states it here instead of on every work item.
   * Structured rather than free text so each prompt can take only the parts it
   * needs.
   */
  productName: text("product_name"),
  productAudience: text("product_audience"),
  productStack: text("product_stack"),
  productConventions: text("product_conventions"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
})

export type WorkspaceMode = (typeof workspaceModeEnum.enumValues)[number]

export const buildStatusEnum = pgEnum("build_status", [
  "queued",
  "running",
  "succeeded",
  "failed",
])

/**
 * A GitHub repository builds can run against. Registered once, then linked to
 * work items. The access token is encrypted — see src/lib/crypto.ts.
 */
export const repositories = pgTable("repository", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  url: text("url").notNull(),
  encryptedToken: text("encrypted_token").notNull(),
  /** Anthropic vault holding this repo's GitHub MCP credential. */
  vaultId: text("vault_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
})

export const buildRuns = pgTable("build_run", {
  id: uuid("id").primaryKey().defaultRandom(),
  workItemId: uuid("work_item_id")
    .notNull()
    .references(() => workItems.id, { onDelete: "cascade" }),
  repositoryId: uuid("repository_id").references(() => repositories.id, {
    onDelete: "set null",
  }),
  status: buildStatusEnum("status").notNull().default("queued"),
  branchName: text("branch_name"),
  pullRequestUrl: text("pull_request_url"),
  outputSummary: text("output_summary"),
  /** The Managed Agents session running this build. */
  sessionId: text("session_id"),
  /**
   * Who pressed Build.
   *
   * The queue advances on a timer with no request and no session, so it has no
   * `getCurrentUser()` to fall back on. This is the actor it attributes the
   * In Review move to, and the address it emails when the run finishes.
   */
  startedByUserId: uuid("started_by_user_id").references(() => users.id, {
    onDelete: "set null",
  }),
  /**
   * When the completion email was attempted.
   *
   * The queue revisits finished rows on every tick, so without this a run
   * would be emailed about every few seconds forever.
   */
  notifiedAt: timestamp("notified_at"),
  /**
   * What the operator asked to be different, on a rebuild. Null on a first
   * build. Its presence is what marks a run as an iteration rather than a
   * fresh start, so the queue resumes instead of starting from scratch.
   */
  reviewNote: text("review_note"),
  /** The run this one iterates on. */
  parentRunId: uuid("parent_run_id").references((): AnyPgColumn => buildRuns.id, {
    onDelete: "set null",
  }),
  /**
   * The branch head before a rebuild started.
   *
   * A rebuild's session transcript still contains the pull request URL from
   * the turn that opened it, so "did we find a PR?" cannot tell a successful
   * iteration from a failed one. A moved branch head can.
   */
  baseSha: text("base_sha"),
  /** Cached pull request state, refreshed by the queue. */
  prNumber: integer("pr_number"),
  prState: text("pr_state"),
  prChecks: text("pr_checks"),
  /** Throttles the GitHub polling — see `syncPullRequests()`. */
  prCheckedAt: timestamp("pr_checked_at"),
  /** When the agent session was actually created — not when it was queued. */
  startedAt: timestamp("started_at"),
  finishedAt: timestamp("finished_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
})

export const buildRunsRelations = relations(buildRuns, ({ one }) => ({
  repository: one(repositories, {
    fields: [buildRuns.repositoryId],
    references: [repositories.id],
  }),
  workItem: one(workItems, {
    fields: [buildRuns.workItemId],
    references: [workItems.id],
  }),
  startedBy: one(users, {
    fields: [buildRuns.startedByUserId],
    references: [users.id],
  }),
  parent: one(buildRuns, {
    fields: [buildRuns.parentRunId],
    references: [buildRuns.id],
    relationName: "runIteration",
  }),
}))

export const chatRoleEnum = pgEnum("chat_role", ["user", "assistant"])

export const changeActorEnum = pgEnum("change_actor", ["user", "agent"])

/** One turn in a work item's orchestration chat. */
export const chatMessages = pgTable("chat_message", {
  id: uuid("id").primaryKey().defaultRandom(),
  workItemId: uuid("work_item_id")
    .notNull()
    .references(() => workItems.id, { onDelete: "cascade" }),
  role: chatRoleEnum("role").notNull(),
  content: text("content").notNull(),
  /** Who sent it. Null on assistant turns. */
  userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
})

/**
 * One recorded change to a work item.
 *
 * `actorUserId` is set for both actor types: for `user` it is who made the
 * edit; for `agent` it is the person who asked for or approved it. That is what
 * lets a row say "written by the agent, approved by Dana".
 */
export const changeLogEntries = pgTable("change_log_entry", {
  id: uuid("id").primaryKey().defaultRandom(),
  workItemId: uuid("work_item_id")
    .notNull()
    .references(() => workItems.id, { onDelete: "cascade" }),
  field: text("field").notNull(),
  oldValue: text("old_value"),
  newValue: text("new_value"),
  actorType: changeActorEnum("actor_type").notNull(),
  actorUserId: uuid("actor_user_id").references(() => users.id, {
    onDelete: "set null",
  }),
  why: text("why"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
})

export const chatMessagesRelations = relations(chatMessages, ({ one }) => ({
  user: one(users, { fields: [chatMessages.userId], references: [users.id] }),
}))

export const changeLogEntriesRelations = relations(
  changeLogEntries,
  ({ one }) => ({
    actor: one(users, {
      fields: [changeLogEntries.actorUserId],
      references: [users.id],
    }),
  })
)

export const workItemsRelations = relations(workItems, ({ one, many }) => ({
  chatMessages: many(chatMessages),
  changeLog: many(changeLogEntries),
  buildRuns: many(buildRuns),
  repository: one(repositories, {
    fields: [workItems.repositoryId],
    references: [repositories.id],
  }),
  owner: one(users, { fields: [workItems.ownerId], references: [users.id] }),
  roadmapEntry: one(roadmapEntries, {
    fields: [workItems.id],
    references: [roadmapEntries.workItemId],
  }),
  prd: one(prds, { fields: [workItems.id], references: [prds.workItemId] }),
  spec: one(specs, { fields: [workItems.id], references: [specs.workItemId] }),
}))

export type UserRole = (typeof userRoleEnum.enumValues)[number]
export type WorkItemStatus = (typeof workItemStatusEnum.enumValues)[number]
export type WorkItemPriority = (typeof workItemPriorityEnum.enumValues)[number]
