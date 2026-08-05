import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

import { auth } from "@/auth"

const PUBLIC_PATHS = [
  "/login",
  "/signup",
  "/forgot-password",
  "/reset-password",
  "/signed-out",
]

/**
 * Reachable even while a session cookie is present. /signed-out exists to clear
 * a session whose user is gone, so bouncing it to /board would recreate the
 * very loop it is there to break.
 */
const SIGNED_IN_ALLOWED = ["/signed-out"]

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  const session = await auth()
  const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p))

  if (!session && !isPublic) {
    const loginUrl = new URL("/login", request.url)
    loginUrl.searchParams.set("callbackUrl", pathname)
    return NextResponse.redirect(loginUrl)
  }

  const allowedWhileSignedIn = SIGNED_IN_ALLOWED.some((p) =>
    pathname.startsWith(p)
  )
  if (session && isPublic && !allowedWhileSignedIn) {
    return NextResponse.redirect(new URL("/board", request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
}
