import { randomBytes } from "node:crypto"
import { eq } from "drizzle-orm"
import { NextResponse } from "next/server"

import { db } from "@/db"
import { passwordResetTokens, users } from "@/db/schema"
import { sendPasswordResetEmail } from "@/lib/resend"
import { forgotPasswordSchema } from "@/lib/validation"

const TOKEN_TTL_MS = 60 * 60 * 1000

export async function POST(request: Request) {
  const parsed = forgotPasswordSchema.safeParse(await request.json())
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    )
  }

  const email = parsed.data.email.toLowerCase()
  const user = await db.query.users.findFirst({
    where: eq(users.email, email),
  })

  if (user) {
    const token = randomBytes(32).toString("hex")
    await db.insert(passwordResetTokens).values({
      userId: user.id,
      token,
      expiresAt: new Date(Date.now() + TOKEN_TTL_MS),
    })

    const resetUrl = new URL(
      `/reset-password?token=${token}`,
      process.env.NEXTAUTH_URL ?? request.url
    ).toString()
    await sendPasswordResetEmail(user.email, resetUrl)
  }

  return NextResponse.json({ ok: true })
}
