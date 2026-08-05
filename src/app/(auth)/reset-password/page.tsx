import Link from "next/link"

import { ResetPasswordForm } from "@/app/(auth)/reset-password/reset-password-form"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

export default async function ResetPasswordPage({
  searchParams,
}: PageProps<"/reset-password">) {
  const { token } = await searchParams

  return (
    <Card>
      <CardHeader>
        <CardTitle>Set a new password</CardTitle>
        <CardDescription>Choose a new password for your account.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {typeof token === "string" && token ? (
          <ResetPasswordForm token={token} />
        ) : (
          <p className="text-sm text-destructive">
            This reset link is missing its token. Request a new one.
          </p>
        )}
        <p className="text-center text-sm text-muted-foreground">
          <Link href="/login" className="font-medium underline underline-offset-4">
            Back to sign in
          </Link>
        </p>
      </CardContent>
    </Card>
  )
}
