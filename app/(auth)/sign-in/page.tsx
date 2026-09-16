import type { Metadata } from "next"

import { SignInForm } from "@/components/auth/sign-in-form"

export const metadata: Metadata = {
  title: "Sign in · Nancyfi",
}

function safeNextPath(next: string | undefined): string {
  if (!next || !next.startsWith("/") || next.startsWith("//")) {
    return "/"
  }
  return next
}

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>
}) {
  const { next } = await searchParams
  return <SignInForm nextPath={safeNextPath(next)} />
}
