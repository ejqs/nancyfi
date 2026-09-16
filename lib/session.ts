import { headers } from "next/headers"
import { redirect } from "next/navigation"

import { auth, type Session } from "@/lib/auth"

/** Control-plane identity — use for membership, never Automerge doc authority. */
export type AuthUser = Session["user"]

export async function getSession() {
  return auth.api.getSession({
    headers: await headers(),
  })
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  const session = await getSession()
  return session?.user ?? null
}

/** Redirects to sign-in when unauthenticated. Prefer for server routes/pages. */
export async function requireUser(): Promise<AuthUser> {
  const user = await getCurrentUser()
  if (!user) {
    redirect("/sign-in")
  }
  return user
}
