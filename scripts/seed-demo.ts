/**
 * Seeds believable demo data: one account per role, plus a set of work items
 * at different stages of the pipeline.
 *
 * Deliberately does NOT touch existing work items — a real build run with a
 * real pull request is the centrepiece of the demo and must survive re-seeding.
 *
 *   npx tsx scripts/seed-demo.ts
 */
import { hash } from "bcryptjs"
import { eq } from "drizzle-orm"

import type { UserRole, WorkItemPriority, WorkItemStatus } from "../src/db/schema"

// Must run before the db module is loaded — it reads DATABASE_URL at import
// time, and static imports are evaluated before any statement here. That is
// why the db modules are imported inside main() rather than at the top.
process.loadEnvFile(".env.local")

const PASSWORD = "supersecret1"

const PEOPLE: { name: string; email: string; role: UserRole }[] = [
  { name: "Dana Reyes", email: "dana@conexus.demo", role: "executive" },
  { name: "Priya Shah", email: "priya@conexus.demo", role: "product_manager" },
  { name: "Marcus Bell", email: "marcus@conexus.demo", role: "engineer" },
  { name: "Ines Okafor", email: "ines@conexus.demo", role: "designer" },
]

type Seed = {
  title: string
  summary: string
  status: WorkItemStatus
  priority: WorkItemPriority
  owner: string
  roadmap?: { targetTimeframe: string; businessGoal: string; why: string }
  prd?: {
    problemStatement: string
    goals: string
    inScope: string
    outOfScope: string
    successCriteria: string
  }
  spec?: {
    technicalApproach: string
    designNotes: string
    acceptanceCriteria: string
  }
}

const ITEMS: Seed[] = [
  {
    title: "SSO for enterprise customers",
    summary: "SAML sign-in so enterprise buyers stop blocking on security review.",
    status: "in_progress",
    priority: "high",
    owner: "priya@conexus.demo",
    roadmap: {
      targetTimeframe: "Q3 2026",
      businessGoal: "Unblock enterprise deals currently stalled in security review.",
      why: "Four of our last six enterprise losses named 'no SSO' as a blocker. Two named it as the only blocker.",
    },
    prd: {
      problemStatement:
        "Enterprise buyers cannot roll us out because every user needs a separate password. Their security teams reject that outright, so deals stall after the technical evaluation.",
      goals:
        "An IT admin can connect their identity provider once, and their staff sign in with their existing corporate account.",
      inScope:
        "SAML 2.0 with Okta and Microsoft Entra. Admin-side setup UI. Fallback to password login for accounts not covered by a connection.",
      outOfScope:
        "SCIM user provisioning, and directory sync. Those come up in the same conversations but are a separate piece of work.",
      successCriteria:
        "An admin completes setup without contacting support, and their users sign in with corporate credentials. The two stalled deals move to security-approved.",
    },
    spec: {
      technicalApproach:
        "Add a SAML provider alongside the existing credentials provider rather than replacing it, so password login keeps working for everyone not behind a connection. Identity-provider config lives in its own table keyed by email domain; sign-in routes on domain match.",
      designNotes:
        "Admin setup is a three-step flow: paste metadata URL, verify, enable. Each step needs an error state — a wrong metadata URL is the common failure and should say so plainly rather than showing a stack trace.",
      acceptanceCriteria:
        "An admin can connect Okta end to end without help. A user at a connected domain lands on their IdP and returns signed in. A user at an unconnected domain still sees password login. A revoked IdP user cannot sign in.",
    },
  },
  {
    title: "Usage-based billing",
    summary: "Charge on consumption instead of per-seat.",
    status: "ready",
    priority: "high",
    owner: "priya@conexus.demo",
    roadmap: {
      targetTimeframe: "Q4 2026",
      businessGoal: "Grow revenue from accounts that expand usage without adding headcount.",
      why: "Our largest accounts have flat seat counts but tripled API volume this year. We capture none of that growth today.",
    },
    prd: {
      problemStatement:
        "Per-seat pricing does not track the value customers get. Heavy API users pay the same as light ones, and expansion revenue is flat despite growing usage.",
      goals:
        "Bill on metered usage, show customers what they are consuming before the invoice, and avoid bill shock.",
      inScope:
        "Metering for API calls and storage. An in-app usage dashboard. Soft limits with warning emails.",
      outOfScope:
        "Migrating existing contracts — new customers only for now. Hard cutoffs when a limit is hit.",
      successCriteria:
        "A customer can see current-period usage that matches their invoice to the cent. No support ticket about a surprise bill in the first quarter.",
    },
  },
  {
    // Deliberately has roadmap context but NO PRD — this is the item the PM
    // builds live during the demo.
    title: "Bulk CSV import for contacts",
    summary: "Sales ops retype contact lists by hand after every event.",
    status: "planning",
    priority: "medium",
    owner: "priya@conexus.demo",
    roadmap: {
      targetTimeframe: "Q4 2026",
      businessGoal: "Cut the manual work that follows every conference.",
      why: "Sales ops spend roughly two days after each event retyping lists. It is the top complaint in their quarterly survey.",
    },
  },
  {
    title: "Mobile push notifications",
    summary: "Notify users on mobile when something needs their attention.",
    status: "planning",
    priority: "low",
    owner: "marcus@conexus.demo",
  },
  {
    title: "Audit log export",
    summary: "Let compliance teams export an immutable activity log.",
    status: "done",
    priority: "medium",
    owner: "marcus@conexus.demo",
    roadmap: {
      targetTimeframe: "Q2 2026",
      businessGoal: "Satisfy SOC 2 requirements our customers inherit.",
      why: "Two enterprise renewals required evidence of audit logging.",
    },
  },
]

async function main() {
  const { db } = await import("../src/db")
  const { changeLogEntries, prds, roadmapEntries, specs, users, workItems } =
    await import("../src/db/schema")

  console.log("Seeding demo data...\n")

  const passwordHash = await hash(PASSWORD, 10)
  const idByEmail = new Map<string, string>()

  for (const person of PEOPLE) {
    const existing = await db.query.users.findFirst({
      where: eq(users.email, person.email),
    })
    if (existing) {
      await db
        .update(users)
        .set({ name: person.name, role: person.role, passwordHash })
        .where(eq(users.id, existing.id))
      idByEmail.set(person.email, existing.id)
      console.log(`  updated ${person.email} (${person.role})`)
      continue
    }
    const [created] = await db
      .insert(users)
      .values({ ...person, passwordHash })
      .returning({ id: users.id })
    idByEmail.set(person.email, created.id)
    console.log(`  created ${person.email} (${person.role})`)
  }

  console.log()

  for (const [index, seed] of ITEMS.entries()) {
    const existing = await db.query.workItems.findFirst({
      where: eq(workItems.title, seed.title),
    })
    if (existing) {
      console.log(`  skipped "${seed.title}" (already present)`)
      continue
    }

    const [item] = await db
      .insert(workItems)
      .values({
        title: seed.title,
        summary: seed.summary,
        status: seed.status,
        priority: seed.priority,
        ownerId: idByEmail.get(seed.owner) ?? null,
        position: index,
      })
      .returning({ id: workItems.id })

    await db
      .insert(roadmapEntries)
      .values({ workItemId: item.id, ...(seed.roadmap ?? {}) })
    await db.insert(prds).values({ workItemId: item.id, ...(seed.prd ?? {}) })
    await db.insert(specs).values({ workItemId: item.id, ...(seed.spec ?? {}) })

    // A little history so the tab is not empty during the demo.
    if (seed.roadmap) {
      await db.insert(changeLogEntries).values({
        workItemId: item.id,
        field: "businessGoal",
        oldValue: null,
        newValue: seed.roadmap.businessGoal,
        actorType: "user",
        actorUserId: idByEmail.get("dana@conexus.demo") ?? null,
      })
    }
    if (seed.prd) {
      await db.insert(changeLogEntries).values({
        workItemId: item.id,
        field: "problemStatement",
        oldValue: null,
        newValue: seed.prd.problemStatement,
        actorType: "agent",
        actorUserId: idByEmail.get("priya@conexus.demo") ?? null,
        why: "Generated draft, approved by the user",
      })
    }

    console.log(`  created "${seed.title}" (${seed.status})`)
  }

  console.log(`\nAll demo accounts use the password: ${PASSWORD}`)
  console.log("Existing work items were left untouched.")
  process.exit(0)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
