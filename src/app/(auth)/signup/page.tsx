import Link from "next/link"

import { SignupForm } from "@/app/(auth)/signup/signup-form"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { getWorkspaceMode, isFirstRun } from "@/lib/workspace"

export default async function SignupPage() {
  const [mode, firstRun] = await Promise.all([getWorkspaceMode(), isFirstRun()])

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create your account</CardTitle>
        <CardDescription>
          {firstRun
            ? "You're the first one here, so you also choose how this workspace runs."
            : mode === "solo"
              ? "You'll see every altitude of every work item."
              : "Your role sets the altitude you see work at by default."}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <SignupForm mode={mode} firstRun={firstRun} />
        <p className="text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link href="/login" className="font-medium underline underline-offset-4">
            Sign in
          </Link>
        </p>
      </CardContent>
    </Card>
  )
}
