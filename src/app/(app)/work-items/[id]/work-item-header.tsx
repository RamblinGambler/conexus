"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useRouter } from "next/navigation"
import { Controller, useForm } from "react-hook-form"
import { toast } from "sonner"

import { updateWorkItemCore } from "@/app/(app)/work-items/[id]/actions"
import type { DetailItem } from "@/app/(app)/work-items/[id]/work-item-detail"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import type { BoardUser } from "@/lib/types"
import {
  updateWorkItemCoreSchema,
  type UpdateWorkItemCoreInput,
} from "@/lib/validation"
import { statusLabel, WORK_ITEM_PRIORITIES } from "@/lib/work-items"

const UNASSIGNED = "unassigned"

export function WorkItemHeader({
  item,
  users,
}: {
  item: DetailItem
  users: BoardUser[]
}) {
  const router = useRouter()
  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<UpdateWorkItemCoreInput>({
    resolver: zodResolver(updateWorkItemCoreSchema),
    defaultValues: {
      id: item.id,
      title: item.title,
      summary: item.summary ?? "",
      priority: item.priority,
      ownerId: item.ownerId ?? "",
    },
  })

  async function onSubmit(values: UpdateWorkItemCoreInput) {
    const result = await updateWorkItemCore(values)
    if (result?.error) {
      setError("root", { message: result.error })
      return
    }
    router.refresh()
    toast.success("Work item updated")
  }

  return (
    <Card>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="mb-4 flex items-center gap-2">
            <Badge variant="outline">{statusLabel(item.status)}</Badge>
            <span className="text-xs text-muted-foreground">
              Status changes on the board
            </span>
          </div>

          <FieldGroup>
            <input type="hidden" {...register("id")} />

            <Field>
              <FieldLabel htmlFor="title">Title</FieldLabel>
              <Input id="title" {...register("title")} />
              <FieldError errors={[errors.title]} />
            </Field>

            <Field>
              <FieldLabel htmlFor="summary">Summary</FieldLabel>
              <Textarea id="summary" rows={2} {...register("summary")} />
              <FieldError errors={[errors.summary]} />
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="priority">Priority</FieldLabel>
                <Controller
                  control={control}
                  name="priority"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger id="priority" className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {WORK_ITEM_PRIORITIES.map((p) => (
                          <SelectItem key={p.value} value={p.value}>
                            {p.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                <FieldError errors={[errors.priority]} />
              </Field>

              <Field>
                <FieldLabel htmlFor="owner">Owner</FieldLabel>
                <Controller
                  control={control}
                  name="ownerId"
                  render={({ field }) => (
                    <Select
                      value={field.value || UNASSIGNED}
                      onValueChange={(v) =>
                        field.onChange(v === UNASSIGNED ? "" : v)
                      }
                    >
                      <SelectTrigger id="owner" className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={UNASSIGNED}>Unassigned</SelectItem>
                        {users.map((u) => (
                          <SelectItem key={u.id} value={u.id}>
                            {u.name ?? u.email}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                <FieldError errors={[errors.ownerId]} />
              </Field>
            </div>

            <FieldError errors={[errors.root]} />

            <div>
              <Button type="submit" disabled={isSubmitting || !isDirty}>
                {isSubmitting ? "Saving..." : "Save details"}
              </Button>
            </div>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  )
}
