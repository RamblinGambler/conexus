"use client"

import { ArrowLeft } from "lucide-react"
import Link from "next/link"

import {
  AltitudeForm,
  type AltitudeField,
} from "@/app/(app)/work-items/[id]/altitude-form"
import {
  BuildPanel,
  type BuildRunView,
  type RepositoryOption,
} from "@/app/(app)/work-items/[id]/build-panel"
import {
  ChatPanel,
  type ChatTurn,
} from "@/app/(app)/work-items/[id]/chat-panel"
import {
  HistoryTab,
  type HistoryRow,
} from "@/app/(app)/work-items/[id]/history-tab"
import {
  ReviewPanel,
  type ReviewRun,
} from "@/app/(app)/work-items/[id]/review-panel"
import { WorkItemHeader } from "@/app/(app)/work-items/[id]/work-item-header"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type {
  UserRole,
  WorkItemPriority,
  WorkItemStatus,
  WorkspaceMode,
} from "@/db/schema"
import {
  ALTITUDES,
  ALTITUDE_LABELS,
  canEditAltitude,
  type Altitude,
} from "@/lib/roles"
import type { BoardUser } from "@/lib/types"

const FIELDS: Record<Altitude, AltitudeField[]> = {
  roadmap: [
    {
      name: "targetTimeframe",
      label: "Target timeframe",
      description: "A quarter or rough date range.",
      multiline: false,
    },
    { name: "businessGoal", label: "Business goal" },
    { name: "why", label: "Why this matters" },
  ],
  prd: [
    { name: "problemStatement", label: "Problem statement" },
    { name: "goals", label: "Goals" },
    { name: "inScope", label: "In scope" },
    { name: "outOfScope", label: "Out of scope" },
    { name: "successCriteria", label: "Success criteria" },
  ],
  spec: [
    { name: "technicalApproach", label: "Technical approach" },
    { name: "designNotes", label: "Design notes" },
    { name: "acceptanceCriteria", label: "Acceptance criteria" },
  ],
}

/** A row from one of the altitude tables; only its text fields are read here. */
type AltitudeRecord = Record<string, unknown> | null

export type DetailItem = {
  id: string
  title: string
  summary: string | null
  status: WorkItemStatus
  priority: WorkItemPriority
  ownerId: string | null
  repositoryId: string | null
  owner: BoardUser | null
  roadmapEntry: AltitudeRecord
  prd: AltitudeRecord
  spec: AltitudeRecord
}

/** Nulls from the database become empty strings so inputs stay controlled. */
function toFormValues(record: AltitudeRecord, fields: AltitudeField[]) {
  return Object.fromEntries(
    fields.map((f) => [f.name, (record?.[f.name] as string | null) ?? ""])
  )
}

export function WorkItemDetail({
  item,
  users,
  role,
  defaultAltitude,
  chat,
  history,
  repositories,
  latestRun,
  runs,
  mode,
}: {
  item: DetailItem
  users: BoardUser[]
  role: UserRole
  defaultAltitude: Altitude
  chat: ChatTurn[]
  history: HistoryRow[]
  repositories: RepositoryOption[]
  latestRun: BuildRunView | null
  runs: ReviewRun[]
  mode: WorkspaceMode
}) {
  const hasSpec = Boolean(
    (item.spec?.technicalApproach as string | null)?.trim() ||
      (item.spec?.acceptanceCriteria as string | null)?.trim()
  )

  const RECORDS: Record<Altitude, AltitudeRecord> = {
    roadmap: item.roadmapEntry,
    prd: item.prd,
    spec: item.spec,
  }

  return (
    <div className="flex flex-col gap-6">
      <Link
        href="/board"
        className="flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Back to board
      </Link>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="flex min-w-0 flex-col gap-6">
          <WorkItemHeader item={item} users={users} />

          {/*
            Solo mode stacks the three altitudes on one page. The tabs only
            existed because different people owned different altitudes — with
            one person holding all three, they are just clicks. History stays
            on its own tab so a long change list doesn't bury the fields.
          */}
          <Tabs defaultValue={mode === "solo" ? "work" : defaultAltitude}>
            <TabsList>
              {mode === "solo" ? (
                <TabsTrigger value="work">Work</TabsTrigger>
              ) : (
                ALTITUDES.map((altitude) => (
                  <TabsTrigger key={altitude} value={altitude}>
                    {ALTITUDE_LABELS[altitude]}
                  </TabsTrigger>
                ))
              )}
              <TabsTrigger value="history">History</TabsTrigger>
            </TabsList>

            {mode === "solo" ? (
              <TabsContent value="work" className="flex flex-col gap-4">
                {ALTITUDES.map((altitude) => (
                  <Card key={altitude}>
                    <CardHeader>
                      <CardTitle>{ALTITUDE_LABELS[altitude]}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <AltitudeForm
                        workItemId={item.id}
                        altitude={altitude}
                        fields={FIELDS[altitude]}
                        values={toFormValues(RECORDS[altitude], FIELDS[altitude])}
                        canEdit={canEditAltitude(role, altitude, mode)}
                      />
                    </CardContent>
                  </Card>
                ))}
              </TabsContent>
            ) : (
              ALTITUDES.map((altitude) => (
                <TabsContent key={altitude} value={altitude}>
                  <Card>
                    <CardContent>
                      <AltitudeForm
                        workItemId={item.id}
                        altitude={altitude}
                        fields={FIELDS[altitude]}
                        values={toFormValues(RECORDS[altitude], FIELDS[altitude])}
                        canEdit={canEditAltitude(role, altitude, mode)}
                      />
                    </CardContent>
                  </Card>
                </TabsContent>
              ))
            )}

            <TabsContent value="history">
              <Card>
                <CardContent>
                  <HistoryTab rows={history} />
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        <div className="flex flex-col gap-6">
          <BuildPanel
            workItemId={item.id}
            repositoryId={item.repositoryId}
            repositories={repositories}
            hasSpec={hasSpec}
            latestRun={latestRun}
          />
          <ReviewPanel workItemId={item.id} runs={runs} />
          <ChatPanel workItemId={item.id} initialMessages={chat} />
        </div>
      </div>
    </div>
  )
}
