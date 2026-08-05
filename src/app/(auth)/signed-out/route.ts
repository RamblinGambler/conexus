import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

import { signOut } from "@/auth"

/**
 * Clears a session whose user no longer exists.
 *
 * The proxy trusts the JWT, but pages resolve the user from the database. When
 * an account is deleted while a cookie is still live the two disagree: the
 * proxy admits the request, the page redirects to /login, and the proxy bounces
 * it straight back — an infinite loop that locks the browser out of the app
 * entirely, including the login page.
 *
 * Clearing the cookie here is what breaks that cycle. The proxy exempts this
 * path from its signed-in redirect so it stays reachable.
 */
export async function GET(request: NextRequest) {
  await signOut({ redirect: false })
  return NextResponse.redirect(new URL("/login", request.url))
}
