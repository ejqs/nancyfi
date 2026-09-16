import type { Metadata } from "next"
import { redirect } from "next/navigation"

import { ForgotPasswordForm } from "@/components/auth/forgot-password-form"
import { getSession } from "@/lib/session"

export const metadata: Metadata = {
  title: "Forgot password · Nancyfi",
}

export default async function ForgotPasswordPage() {
  const session = await getSession()
  if (session) {
    redirect("/")
  }
  return <ForgotPasswordForm />
}
