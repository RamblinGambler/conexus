"use client"

import { Check, Undo2 } from "lucide-react"
import { useState } from "react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"

export type PreviewField = {
  name: string
  label: string
  current: string
  proposed: string
}

/**
 * Shows generated content next to what is already there and writes only the
 * fields the user accepts. There is no version history in this milestone, so
 * generation must never overwrite existing work without a decision.
 */
export function GenerationPreview({
  open,
  onOpenChange,
  title,
  description,
  fields,
  saving,
  onApply,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  fields: PreviewField[]
  saving: boolean
  onApply: (accepted: Record<string, string>) => void
}) {
  const changed = fields.filter((f) => f.proposed.trim() !== f.current.trim())
  const [rejected, setRejected] = useState<Set<string>>(new Set())

  const toggle = (name: string) =>
    setRejected((current) => {
      const next = new Set(current)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })

  const accepted = changed.filter((f) => !rejected.has(f.name))

  function apply() {
    onApply(Object.fromEntries(accepted.map((f) => [f.name, f.proposed])))
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-2">
          {changed.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              The generated content matches what&apos;s already there — nothing
              to apply.
            </p>
          ) : (
            changed.map((field) => {
              const isRejected = rejected.has(field.name)
              return (
                <div
                  key={field.name}
                  data-testid={`preview-${field.name}`}
                  className={cn(
                    "rounded-lg border p-3 transition-opacity",
                    isRejected && "opacity-50"
                  )}
                >
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <span className="text-sm font-medium">{field.label}</span>
                    <Button
                      type="button"
                      variant={isRejected ? "outline" : "secondary"}
                      size="sm"
                      onClick={() => toggle(field.name)}
                    >
                      {isRejected ? (
                        <>
                          <Undo2 className="size-3.5" />
                          Skipped
                        </>
                      ) : (
                        <>
                          <Check className="size-3.5" />
                          Accepted
                        </>
                      )}
                    </Button>
                  </div>

                  {field.current.trim() ? (
                    <div className="mb-2">
                      <Badge variant="outline" className="mb-1">
                        Current
                      </Badge>
                      <p className="text-sm whitespace-pre-wrap text-muted-foreground line-through decoration-muted-foreground/40">
                        {field.current}
                      </p>
                    </div>
                  ) : null}

                  <div>
                    <Badge variant="secondary" className="mb-1">
                      {field.current.trim() ? "Proposed" : "New"}
                    </Badge>
                    <p className="text-sm whitespace-pre-wrap">
                      {field.proposed}
                    </p>
                  </div>
                </div>
              )
            })
          )}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Discard all
          </Button>
          <Button
            type="button"
            onClick={apply}
            disabled={saving || accepted.length === 0}
          >
            {saving
              ? "Applying..."
              : `Apply ${accepted.length} ${accepted.length === 1 ? "change" : "changes"}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
