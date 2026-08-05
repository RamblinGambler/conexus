import { eq } from "drizzle-orm"

import { auth } from "@/auth"
import { db } from "@/db"
import { users } from "@/db/schema"

/**
 * The JWT carries identity only. Profile fields (name, avatar, role) are read
 * from the database so a change in settings takes effect immediately rather
 * than waiting for the token to be reissued.
 */
export async function getCurrentUser() {
  const session = await auth()
  if (!session?.user?.id) return null

  return (
    (await db.query.users.findFirst({ where: eq(users.id, session.user.id) })) ??
    null
  )
}
