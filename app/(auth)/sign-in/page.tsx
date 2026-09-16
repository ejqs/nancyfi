import type { Metadata } from "next"
import { redirect } from "next/navigation"

import { SignInForm } from "@/components/auth/sign-in-form"
import { safeNextPath } from "@/lib/safe-next-path"
import { getSession } from "@/lib/session"

export const metadata: Metadata = {
  title: "Sign in · Nancyfi",
}

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>
}) {
  const { next } = await searchParams
  const nextPath = safeNextPath(next)
  const session = await getSession()
  if (session) {
    redirect(nextPath)
  }
  return <SignInForm nextPath={nextPath} />
}
