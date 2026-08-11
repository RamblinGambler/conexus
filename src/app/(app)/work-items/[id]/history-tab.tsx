import { ArrowRight, Bot, User } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { fieldLabel } from "@/lib/field-labels"

export type HistoryRow = {
  id: string
  field: string
  oldValue: string | null
  newValue: string | null
  actorType: "user" | "agent"
  actorName: string | null
  why: string | null
  createdAt: Date
}

/** Long-form fields are truncated — a real diff view is out of scope here. */
function truncate(value: string | null) {
  if (!value) return "(empty)"
  return value.length > 140 ? `${value.slice(0, 140)}…` : value
}

export function HistoryTab({ rows }: { rows: HistoryRow[] }) {
  if (rows.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Nothing has changed yet. Edits made here, on the board, or through the
        chat agent will show up in this list.
      </p>
    )
  }

  return (
    <ol className="flex flex-col gap-3">
      {rows.map((row) => (
        <li
          key={row.id}
          data-testid="history-row"
          data-field={row.field}
          data-actor={row.actorType}
          className="rounded-lg border p-3"
        >
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <Badge variant="secondary">{fieldLabel(row.field)}</Badge>
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              {row.actorType === "agent" ? (
                <>
                  <Bot className="size-3.5" />
                  Orchestration Agent
                  {row.actorName ? ` · approved by ${row.actorName}` : null}
                </>
              ) : (
                <>
                  <User className="size-3.5" />
                  {row.actorName ?? "Unknown user"}
                </>
              )}
            </span>
            <span className="ml-auto text-xs text-muted-foreground">
              {row.createdAt.toLocaleString()}
            </span>
          </div>

          <div className="flex flex-wrap items-start gap-2 text-sm">
            <span className="text-muted-foreground line-through decoration-muted-foreground/40">
              {truncate(row.oldValue)}
            </span>
            <ArrowRight className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            <span>{truncate(row.newValue)}</span>
          </div>

          {row.why ? (
            <p className="mt-2 text-xs text-muted-foreground">
              Why: {row.why}
            </p>
          ) : null}
        </li>
      ))}
    </ol>
  )
}
