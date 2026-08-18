"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"

import {
  updateDefaultRepository,
  updateWorkspaceMode,
} from "@/app/(app)/settings/workspace-actions"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { WorkspaceMode } from "@/db/schema"

const NONE = "none"

export function WorkspaceCard({
  mode,
  defaultRepositoryId,
  repositories,
}: {
  mode: WorkspaceMode
  defaultRepositoryId: string | null
  repositories: { id: string; name: string }[]
}) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)

  async function onModeChange(next: string) {
    setSaving(true)
    const result = await updateWorkspaceMode(next as WorkspaceMode)
    setSaving(false)

    if (result?.error) {
      toast.error(result.error)
      return
    }
    router.refresh()
    toast.success(next === "solo" ? "Switched to solo" : "Switched to team")
  }

  async function onRepositoryChange(next: string) {
    setSaving(true)
    const result = await updateDefaultRepository(next === NONE ? null : next)
    setSaving(false)

    if (result?.error) {
      toast.error(result.error)
      return
    }
    router.refresh()
    toast.success("Default repository updated")
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Workspace</CardTitle>
        <CardDescription>
          How this install runs, and what new work items start with.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <Field>
          <FieldLabel htmlFor="workspace-mode">Mode</FieldLabel>
          <Select value={mode} onValueChange={onModeChange} disabled={saving}>
            <SelectTrigger id="workspace-mode" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="solo">Solo — one person, every altitude</SelectItem>
              <SelectItem value="team">Team — each role owns one altitude</SelectItem>
            </SelectContent>
          </Select>
          <FieldDescription>
            {mode === "solo"
              ? "Everyone can edit the Roadmap, PRD, and Spec. Switching to Team restores the per-role restrictions using each person's stored role."
              : "Each person can only edit the altitude matching their role. Switching to Solo removes those restrictions for everyone — roles are kept, just not enforced."}
          </FieldDescription>
        </Field>

        <Field>
          <FieldLabel htmlFor="default-repository">Default repository</FieldLabel>
          <Select
            value={defaultRepositoryId ?? NONE}
            onValueChange={onRepositoryChange}
            disabled={saving}
          >
            <SelectTrigger id="default-repository" className="w-full">
              <SelectValue placeholder="None" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>None</SelectItem>
              {repositories.map((repo) => (
                <SelectItem key={repo.id} value={repo.id}>
                  {repo.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FieldDescription>
            New work items link to this automatically. Existing items are left
            alone.
          </FieldDescription>
        </Field>
      </CardContent>
    </Card>
  )
}
