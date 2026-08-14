import { asc } from "drizzle-orm"
import Link from "next/link"
import { redirect } from "next/navigation"

import { RepositoryList } from "@/app/(app)/settings/repositories/repository-list"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { db } from "@/db"
import { repositories } from "@/db/schema"
import { getCurrentUser } from "@/lib/session"

export default async function RepositoriesPage() {
  const user = await getCurrentUser()
  if (!user) {
    redirect("/signed-out")
  }

  const rows = await db.query.repositories.findMany({
    columns: { id: true, name: true, url: true, createdAt: true },
    orderBy: [asc(repositories.name)],
  })

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Repositories</h1>
        <p className="text-muted-foreground">
          Repositories that build runs can push to. Link one to a work item from
          its detail page.
        </p>
        <Link
          href="/settings"
          className="w-fit text-sm text-muted-foreground underline underline-offset-4"
        >
          Back to settings
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Connected repositories</CardTitle>
          <CardDescription>
            Access tokens are encrypted before they are stored and are never
            shown again after you add them.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <RepositoryList repositories={rows} />
        </CardContent>
      </Card>
    </div>
  )
}
