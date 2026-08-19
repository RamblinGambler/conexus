"use client"

import { Sparkles } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"

import {
  draftProductBriefFromRepository,
  updateProductBrief,
} from "@/app/(app)/settings/workspace-actions"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import type { ProductBriefInput } from "@/lib/validation"

const FIELDS: { name: keyof ProductBriefInput; label: string; hint: string }[] = [
  {
    name: "productName",
    label: "What the product is",
    hint: "A couple of sentences someone outside the team would understand.",
  },
  {
    name: "productAudience",
    label: "Who it is for",
    hint: "The actual users, and what they are trying to do.",
  },
  {
    name: "productStack",
    label: "Built with",
    hint: "Languages, frameworks, database, notable libraries.",
  },
  {
    name: "productConventions",
    label: "Conventions and constraints",
    hint: "How code is written here — testing, structure, anything that always applies.",
  },
]

export function ProductCard({
  brief,
  repositories,
}: {
  brief: ProductBriefInput
  repositories: { id: string; name: string }[]
}) {
  const router = useRouter()
  const [values, setValues] = useState<ProductBriefInput>(brief)
  const [saving, setSaving] = useState(false)
  const [drafting, setDrafting] = useState(false)
  const [source, setSource] = useState(repositories[0]?.id ?? "")

  async function save() {
    setSaving(true)
    const result = await updateProductBrief(values)
    setSaving(false)

    if (result?.error) {
      toast.error(result.error)
      return
    }
    router.refresh()
    toast.success("Product brief saved")
  }

  async function draft() {
    if (!source) return
    setDrafting(true)
    const result = await draftProductBriefFromRepository(source)
    setDrafting(false)

    if ("error" in result) {
      toast.error(result.error)
      return
    }
    setValues(result.draft)
    toast.success("Drafted — review it and save")
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Product</CardTitle>
        <CardDescription>
          Written once and read by every generation, so you never restate it on
          a work item. Takes effect on the next thing you generate.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        {repositories.length > 0 ? (
          <div className="flex flex-wrap items-end gap-2">
            <Field className="min-w-48 flex-1">
              <FieldLabel htmlFor="brief-source">Draft from a repository</FieldLabel>
              <Select value={source} onValueChange={setSource}>
                <SelectTrigger id="brief-source" className="w-full">
                  <SelectValue placeholder="Choose a repository" />
                </SelectTrigger>
                <SelectContent>
                  {repositories.map((repo) => (
                    <SelectItem key={repo.id} value={repo.id}>
                      {repo.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Button
              type="button"
              variant="secondary"
              data-testid="draft-brief"
              onClick={draft}
              disabled={drafting || !source}
            >
              <Sparkles className="size-4" />
              {drafting ? "Reading..." : "Draft"}
            </Button>
          </div>
        ) : null}

        <FieldGroup>
          {FIELDS.map((field) => (
            <Field key={field.name}>
              <FieldLabel htmlFor={`brief-${field.name}`}>
                {field.label}
              </FieldLabel>
              <Textarea
                id={`brief-${field.name}`}
                rows={3}
                value={values[field.name] ?? ""}
                onChange={(e) =>
                  setValues((v) => ({ ...v, [field.name]: e.target.value }))
                }
              />
              <FieldDescription>{field.hint}</FieldDescription>
            </Field>
          ))}

          <div>
            <Button
              type="button"
              data-testid="save-brief"
              onClick={save}
              disabled={saving}
            >
              {saving ? "Saving..." : "Save product brief"}
            </Button>
          </div>
        </FieldGroup>
      </CardContent>
    </Card>
  )
}
