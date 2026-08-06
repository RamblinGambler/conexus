"use client"

import { Lock, Sparkles } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

import {
  applyGeneratedDraft,
  generateDesignNotes,
  generateSpec,
  updatePrd,
  updateRoadmap,
  updateSpec,
} from "@/app/(app)/work-items/[id]/actions"
import {
  GenerationPreview,
  type PreviewField,
} from "@/app/(app)/work-items/[id]/generation-preview"
import { PrdInterviewDialog } from "@/app/(app)/work-items/[id]/prd-interview-dialog"
import { Button } from "@/components/ui/button"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { rolesForAltitude, type Altitude } from "@/lib/roles"
import type { PrdInput, RoadmapInput, SpecInput } from "@/lib/validation"

export type AltitudeField = {
  name: string
  label: string
  description?: string
  multiline?: boolean
}

type AltitudePayload = { workItemId: string } & Record<string, string>

/**
 * Each altitude has its own field set, so the payload is assembled dynamically
 * from the field descriptors. The matching server action re-validates it with
 * its own zod schema, which is what actually guarantees the shape.
 */
function saveAltitude(altitude: Altitude, payload: AltitudePayload) {
  switch (altitude) {
    case "roadmap":
      return updateRoadmap(payload as RoadmapInput)
    case "prd":
      return updatePrd(payload as PrdInput)
    case "spec":
      return updateSpec(payload as SpecInput)
  }
}

export function AltitudeForm({
  workItemId,
  altitude,
  fields,
  values,
  canEdit,
}: {
  workItemId: string
  altitude: Altitude
  fields: AltitudeField[]
  values: Record<string, string>
  canEdit: boolean
}) {
  const [draft, setDraft] = useState(values)
  const [saving, setSaving] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [preview, setPreview] = useState<{
    title: string
    description: string
    fields: PreviewField[]
  } | null>(null)

  const owners = rolesForAltitude(altitude)
    .map((r) => `${r.label}s`)
    .join(" and ")

  /**
   * `fromAgent` routes through applyGeneratedDraft so history records the
   * content as agent-written and user-approved rather than hand-typed.
   */
  async function persist(next: Record<string, string>, fromAgent = false) {
    const payload = { workItemId, ...next }
    const result =
      fromAgent && altitude !== "roadmap"
        ? await applyGeneratedDraft(altitude, payload as PrdInput | SpecInput)
        : await saveAltitude(altitude, payload)

    if (result?.error) {
      toast.error(result.error)
      return false
    }
    return true
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault()
    setSaving(true)
    const ok = await persist(draft)
    setSaving(false)
    if (ok) toast.success("Saved")
  }

  /** Turns a generated draft into a reviewable diff against current values. */
  function openPreview(
    title: string,
    description: string,
    proposed: Record<string, string>
  ) {
    setPreview({
      title,
      description,
      fields: Object.entries(proposed).map(([name, value]) => ({
        name,
        label: fields.find((f) => f.name === name)?.label ?? name,
        current: draft[name] ?? "",
        proposed: value,
      })),
    })
  }

  async function applyPreview(accepted: Record<string, string>) {
    const next = { ...draft, ...accepted }
    setSaving(true)
    const ok = await persist(next, true)
    setSaving(false)
    if (!ok) return

    setDraft(next)
    setPreview(null)
    toast.success("Applied")
  }

  async function runGeneration(
    label: string,
    description: string,
    run: () => Promise<{ error: string } | { ok: true; draft: object }>
  ) {
    setGenerating(true)
    const result = await run()
    setGenerating(false)

    if ("error" in result) {
      toast.error(result.error)
      return
    }
    openPreview(label, description, result.draft as Record<string, string>)
  }

  return (
    <>
      {canEdit && altitude !== "roadmap" ? (
        <div className="mb-4 flex flex-wrap gap-2">
          {altitude === "prd" ? (
            <PrdInterviewDialog
              workItemId={workItemId}
              onDraft={(generated) =>
                openPreview(
                  "Review the drafted PRD",
                  "Generated from your interview answers. Nothing is saved until you apply.",
                  generated as unknown as Record<string, string>
                )
              }
            />
          ) : null}

          {altitude === "spec" ? (
            <>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={generating}
                onClick={() =>
                  runGeneration(
                    "Review the generated spec",
                    "Drafted from this work item's PRD. Nothing is saved until you apply.",
                    () => generateSpec(workItemId)
                  )
                }
              >
                <Sparkles className="size-4" />
                {generating ? "Generating..." : "Generate spec"}
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={generating}
                onClick={() =>
                  runGeneration(
                    "Review the generated design notes",
                    "Drafted from this work item's PRD. Nothing is saved until you apply.",
                    () => generateDesignNotes(workItemId)
                  )
                }
              >
                <Sparkles className="size-4" />
                {generating ? "Generating..." : "Generate design notes"}
              </Button>
            </>
          ) : null}
        </div>
      ) : null}

      <form onSubmit={onSubmit}>
        {!canEdit ? (
          <p className="mb-4 flex items-center gap-2 rounded-md border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
            <Lock className="size-3.5 shrink-0" />
            Read-only for your role. Only {owners} can edit this view.
          </p>
        ) : null}

        <FieldGroup>
          {fields.map((field) => (
            <Field key={field.name}>
              <FieldLabel htmlFor={`${altitude}-${field.name}`}>
                {field.label}
              </FieldLabel>
              {field.multiline === false ? (
                <Input
                  id={`${altitude}-${field.name}`}
                  disabled={!canEdit}
                  value={draft[field.name] ?? ""}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, [field.name]: e.target.value }))
                  }
                />
              ) : (
                <Textarea
                  id={`${altitude}-${field.name}`}
                  rows={3}
                  disabled={!canEdit}
                  value={draft[field.name] ?? ""}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, [field.name]: e.target.value }))
                  }
                />
              )}
              {field.description ? (
                <FieldDescription>{field.description}</FieldDescription>
              ) : null}
            </Field>
          ))}

          {canEdit ? (
            <div>
              <Button type="submit" disabled={saving}>
                {saving ? "Saving..." : "Save"}
              </Button>
            </div>
          ) : null}
        </FieldGroup>
      </form>

      {preview ? (
        <GenerationPreview
          open
          onOpenChange={(next) => {
            if (!next) setPreview(null)
          }}
          title={preview.title}
          description={preview.description}
          fields={preview.fields}
          saving={saving}
          onApply={applyPreview}
        />
      ) : null}
    </>
  )
}
