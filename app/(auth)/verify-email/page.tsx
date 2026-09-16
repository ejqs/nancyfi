import type { Metadata } from "next"

import { VerifyEmailView } from "@/components/auth/verify-email-view"

export const metadata: Metadata = {
  title: "Verify email · Nancyfi",
}

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>
}) {
  const { email } = await searchParams
  return <VerifyEmailView email={email} />
}
