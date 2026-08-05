import { redirect } from "next/navigation"

import { NavBar } from "@/components/nav-bar"
import { getCurrentUser } from "@/lib/session"
import { getWorkspaceMode } from "@/lib/workspace"

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const user = await getCurrentUser()
  if (!user) {
    redirect("/signed-out")
  }

  const mode = await getWorkspaceMode()

  return (
    <div className="flex min-h-svh flex-col">
      <NavBar
        name={user.name}
        email={user.email}
        image={user.image}
        role={user.role}
        mode={mode}
      />
      <main className="mx-auto w-full max-w-[100rem] flex-1 px-4 py-8">
        {children}
      </main>
    </div>
  )
}
