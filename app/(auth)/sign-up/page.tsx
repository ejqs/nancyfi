import type { Metadata } from "next"

import { SignUpForm } from "@/components/auth/sign-up-form"

export const metadata: Metadata = {
  title: "Sign up · Nancyfi",
}

function safeNextPath(next: string | undefined): string | undefined {
  if (!next || !next.startsWith("/") || next.startsWith("//")) {
    return undefined
  }
  return next
}

export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>
}) {
  const { next } = await searchParams
  return <SignUpForm nextPath={safeNextPath(next)} />
}
