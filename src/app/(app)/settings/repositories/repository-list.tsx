"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { FolderGit2, Trash2 } from "lucide-react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"

import {
  addRepository,
  removeRepository,
} from "@/app/(app)/settings/repositories/actions"
import { Button } from "@/components/ui/button"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"

const formSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  url: z.string().trim().min(1, "Repository URL is required"),
  token: z.string().trim().min(1, "An access token is required"),
})

type FormValues = z.infer<typeof formSchema>

export type RepositoryRow = {
  id: string
  name: string
  url: string
  createdAt: Date
}

export function RepositoryList({
  repositories,
}: {
  repositories: RepositoryRow[]
}) {
  const router = useRouter()
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { name: "", url: "", token: "" },
  })

  async function onSubmit(values: FormValues) {
    const result = await addRepository(values)
    if (result?.error) {
      setError("root", { message: result.error })
      return
    }
    reset()
    router.refresh()
    toast.success("Repository added")
  }

  async function onRemove(id: string) {
    const result = await removeRepository(id)
    if (result?.error) {
      toast.error(result.error)
      return
    }
    router.refresh()
    toast.success("Repository removed")
  }

  return (
    <div className="flex flex-col gap-6">
      {repositories.length > 0 ? (
        <ul className="flex flex-col gap-2" data-testid="repository-list">
          {repositories.map((repo) => (
            <li
              key={repo.id}
              data-testid="repository-row"
              className="flex items-center gap-3 rounded-lg border p-3"
            >
              <FolderGit2 className="size-4 shrink-0 text-muted-foreground" />
              <div className="flex min-w-0 flex-col">
                <span className="text-sm font-medium">{repo.name}</span>
                <span className="truncate text-xs text-muted-foreground">
                  {repo.url}
                </span>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="ml-auto"
                aria-label={`Remove ${repo.name}`}
                onClick={() => onRemove(repo.id)}
              >
                <Trash2 className="size-4" />
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">
          No repositories yet. Add one below.
        </p>
      )}

      <Separator />

      <form onSubmit={handleSubmit(onSubmit)}>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="repo-name">Name</FieldLabel>
            <Input id="repo-name" placeholder="conexus" {...register("name")} />
            <FieldError errors={[errors.name]} />
          </Field>

          <Field>
            <FieldLabel htmlFor="repo-url">Repository URL</FieldLabel>
            <Input
              id="repo-url"
              placeholder="https://github.com/owner/repo"
              {...register("url")}
            />
            <FieldError errors={[errors.url]} />
          </Field>

          <Field>
            <FieldLabel htmlFor="repo-token">Access token</FieldLabel>
            <Input
              id="repo-token"
              type="password"
              autoComplete="off"
              placeholder="github_pat_..."
              {...register("token")}
            />
            <FieldDescription>
              Needs Contents read and write to push branches, and pull request
              access to open PRs. Encrypted before storage, and never shown
              again.
            </FieldDescription>
            <FieldError errors={[errors.token]} />
          </Field>

          <FieldError errors={[errors.root]} />

          <div>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Adding..." : "Add repository"}
            </Button>
          </div>
        </FieldGroup>
      </form>
    </div>
  )
}
