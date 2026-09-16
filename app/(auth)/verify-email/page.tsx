import type { Metadata } from "next"
import { redirect } from "next/navigation"

import { VerifyEmailView } from "@/components/auth/verify-email-view"
import { safeNextPath } from "@/lib/safe-next-path"
import { getSession } from "@/lib/session"

export const metadata: Metadata = {
  title: "Verify email · Nancyfi",
}

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string; next?: string }>
}) {
  const { email, next } = await searchParams
  const nextPath = safeNextPath(next)
  const session = await getSession()
  if (session) {
    redirect(nextPath)
  }
  return (
    <VerifyEmailView
      email={email}
      nextPath={nextPath === "/" ? undefined : nextPath}
    />
  )
}
