"use server"

import { eq } from "drizzle-orm"
import { revalidatePath } from "next/cache"

import { auth } from "@/auth"
import { db } from "@/db"
import { users } from "@/db/schema"
import { profileSchema, type ProfileInput } from "@/lib/validation"

export async function updateProfile(input: ProfileInput) {
  const session = await auth()
  if (!session?.user) {
    return { error: "Not signed in" }
  }

  const parsed = profileSchema.safeParse(input)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" }
  }

  const { name, image, role } = parsed.data
  await db
    .update(users)
    .set({ name, image: image || null, role, updatedAt: new Date() })
    .where(eq(users.id, session.user.id))

  revalidatePath("/settings")
  revalidatePath("/board")
  return { ok: true }
}
