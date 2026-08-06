"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { Plus } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { Controller, useForm } from "react-hook-form"
import { toast } from "sonner"

import { createWorkItem } from "@/app/(app)/board/actions"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
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
import { createWorkItemSchema, type CreateWorkItemInput } from "@/lib/validation"
import { WORK_ITEM_PRIORITIES } from "@/lib/work-items"

const UNASSIGNED = "unassigned"

export function NewWorkItemDialog({ users }: { users: BoardUser[] }) {
  const [open, setOpen] = useState(false)
  const router = useRouter()

  const {
    register,
    control,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<CreateWorkItemInput>({
    resolver: zodResolver(createWorkItemSchema),
    defaultValues: { title: "", summary: "", priority: "medium", ownerId: "" },
  })

  async function onSubmit(values: CreateWorkItemInput) {
    const result = await createWorkItem(values)
    if (result?.error) {
      setError("root", { message: result.error })
      return
    }

    setOpen(false)
    reset()
    router.refresh()
    toast.success("Work item created")
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="size-4" />
          New work item
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={handleSubmit(onSubmit)}>
          <DialogHeader>
            <DialogTitle>New work item</DialogTitle>
            <DialogDescription>
              It starts in Planning. Roadmap, PRD, and Spec get filled in from
              its detail view.
            </DialogDescription>
          </DialogHeader>

          <FieldGroup className="py-4">
            <Field>
              <FieldLabel htmlFor="title">Title</FieldLabel>
              <Input id="title" autoComplete="off" {...register("title")} />
              <FieldError errors={[errors.title]} />
            </Field>

            <Field>
              <FieldLabel htmlFor="summary">Summary</FieldLabel>
              <Textarea id="summary" rows={3} {...register("summary")} />
              <FieldError errors={[errors.summary]} />
            </Field>

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

            <FieldError errors={[errors.root]} />
          </FieldGroup>

          <DialogFooter>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Creating..." : "Create work item"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
