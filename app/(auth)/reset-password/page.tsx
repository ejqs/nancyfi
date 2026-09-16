import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { Suspense } from "react"

import { ResetPasswordForm } from "@/components/auth/reset-password-form"
import { getSession } from "@/lib/session"

export const metadata: Metadata = {
  title: "Reset password · Nancyfi",
}

export default async function ResetPasswordPage() {
  const session = await getSession()
  if (session) {
    redirect("/")
  }
  return (
    <Suspense>
      <ResetPasswordForm />
    </Suspense>
  )
}
