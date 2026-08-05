import Link from "next/link"

import { ThemeToggle } from "@/components/theme-toggle"
import { UserMenu } from "@/components/user-menu"
import { Badge } from "@/components/ui/badge"
import type { UserRole, WorkspaceMode } from "@/db/schema"
import { roleLabel } from "@/lib/roles"

export function NavBar({
  name,
  email,
  image,
  role,
  mode,
}: {
  name?: string | null
  email?: string | null
  image?: string | null
  role: UserRole
  mode: WorkspaceMode
}) {
  return (
    <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur">
      <div className="mx-auto flex h-14 w-full max-w-[100rem] items-center justify-between gap-4 px-4">
        <div className="flex items-center gap-3">
          <Link href="/board" className="font-semibold tracking-tight">
            Conexus
          </Link>
          <Badge variant="secondary">
            {mode === "solo" ? "Solo" : roleLabel(role)}
          </Badge>
          <nav className="flex items-center gap-3 text-sm text-muted-foreground">
            <Link href="/board" className="hover:text-foreground">
              Board
            </Link>
            <Link href="/builds" className="hover:text-foreground">
              Builds
            </Link>
          </nav>
        </div>
        <div className="flex items-center gap-1">
          <ThemeToggle />
          <UserMenu name={name} email={email} image={image} role={role} />
        </div>
      </div>
    </header>
  )
}
