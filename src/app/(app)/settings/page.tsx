import { asc } from "drizzle-orm"
import Link from "next/link"
import { redirect } from "next/navigation"

import { ProfileForm } from "@/app/(app)/settings/profile-form"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { ProductCard } from "@/app/(app)/settings/product-card"
import { WorkspaceCard } from "@/app/(app)/settings/workspace-card"
import { db } from "@/db"
import { repositories } from "@/db/schema"
import { getCurrentUser } from "@/lib/session"
import { getWorkspaceSettings } from "@/lib/workspace"

export default async function SettingsPage() {
  const user = await getCurrentUser()
  if (!user) {
    redirect("/signed-out")
  }

  const [settings, repos] = await Promise.all([
    getWorkspaceSettings(),
    db.query.repositories.findMany({
      columns: { id: true, name: true },
      orderBy: [asc(repositories.name)],
    }),
  ])

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">
          Manage your profile and how this workspace runs.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>
            {settings.mode === "solo"
              ? "You see every altitude of every work item."
              : "Your role determines the altitude you see work items at by default."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ProfileForm
            email={user.email}
            defaultValues={{
              name: user.name ?? "",
              image: user.image ?? "",
              role: user.role,
            }}
            showRole={settings.mode === "team"}
          />
        </CardContent>
      </Card>

      <ProductCard
        brief={{
          productName: settings.productName ?? "",
          productAudience: settings.productAudience ?? "",
          productStack: settings.productStack ?? "",
          productConventions: settings.productConventions ?? "",
        }}
        repositories={repos}
      />

      <WorkspaceCard
        mode={settings.mode}
        defaultRepositoryId={settings.defaultRepositoryId}
        repositories={repos}
      />

      <Card>
        <CardHeader>
          <CardTitle>Repositories</CardTitle>
          <CardDescription>
            Connect the GitHub repositories that build runs push to.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Link
            href="/settings/repositories"
            className="text-sm underline underline-offset-4"
          >
            Manage repositories
          </Link>
        </CardContent>
      </Card>
    </div>
  )
}
