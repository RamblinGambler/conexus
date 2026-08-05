import { eq } from "drizzle-orm"
import { NextResponse } from "next/server"

import { db } from "@/db"
import { passwordResetTokens, users } from "@/db/schema"
import { hashPassword } from "@/lib/password"
import { resetPasswordSchema } from "@/lib/validation"

export async function POST(request: Request) {
  const parsed = resetPasswordSchema.safeParse(await request.json())
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    )
  }

  const { token, password } = parsed.data
  const record = await db.query.passwordResetTokens.findFirst({
    where: eq(passwordResetTokens.token, token),
  })

  if (!record || record.expiresAt < new Date()) {
    return NextResponse.json(
      { error: "This reset link is invalid or has expired" },
      { status: 400 }
    )
  }

  await db
    .update(users)
    .set({ passwordHash: await hashPassword(password), updatedAt: new Date() })
    .where(eq(users.id, record.userId))

  await db
    .delete(passwordResetTokens)
    .where(eq(passwordResetTokens.userId, record.userId))

  return NextResponse.json({ ok: true })
}
