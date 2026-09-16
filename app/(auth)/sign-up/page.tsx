import type { Metadata } from "next"
import { redirect } from "next/navigation"

import { SignUpForm } from "@/components/auth/sign-up-form"
import { safeNextPath } from "@/lib/safe-next-path"
import { getSession } from "@/lib/session"

export const metadata: Metadata = {
  title: "Sign up · Nancyfi",
}

export default async function SignUpPage({
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
  return (
    <SignUpForm nextPath={nextPath === "/" ? undefined : nextPath} />
  )
}
