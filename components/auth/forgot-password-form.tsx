"use client"

import { useState } from "react"
import Link from "next/link"

import { AuthShell } from "@/components/auth/auth-shell"
import { Button } from "@/components/ui/button"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { authClient } from "@/lib/auth-client"

export function ForgotPasswordForm() {
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)
  const [pending, setPending] = useState(false)

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setPending(true)

    const form = new FormData(event.currentTarget)
    const email = String(form.get("email") ?? "")

    const { error: resetError } = await authClient.requestPasswordReset({
      email,
      redirectTo: `${window.location.origin}/reset-password`,
    })

    setPending(false)

    if (resetError) {
      setError(resetError.message ?? "Unable to send reset email.")
      return
    }

    setSent(true)
  }

  return (
    <AuthShell
      title="Reset your password"
      description="Enter your email and we will send a reset link."
    >
      {sent ? (
        <div className="flex flex-col gap-4 text-center">
          <p className="text-xs/relaxed text-muted-foreground">
            If an account exists for that email, a reset link is on its way.
          </p>
          <Button
            render={<Link href="/sign-in" />}
            nativeButton={false}
            size="lg"
            className="w-full"
          >
            Back to sign in
          </Button>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <FieldGroup>
            <Field data-invalid={!!error || undefined}>
              <FieldLabel htmlFor="email">Email</FieldLabel>
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                placeholder="you@example.com"
                aria-invalid={!!error || undefined}
              />
              <FieldDescription>
                We will email you a link to choose a new password.
              </FieldDescription>
              {error ? <FieldError>{error}</FieldError> : null}
            </Field>
          </FieldGroup>

          <Button type="submit" size="lg" className="w-full" disabled={pending}>
            {pending ? <Spinner data-icon="inline-start" /> : null}
            Send reset link
          </Button>

          <p className="text-center text-xs/relaxed text-muted-foreground">
            <Link
              href="/sign-in"
              className="text-foreground underline-offset-4 hover:underline"
            >
              Back to sign in
            </Link>
          </p>
        </form>
      )}
    </AuthShell>
  )
}
