"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"

import { AuthShell } from "@/components/auth/auth-shell"
import { Button } from "@/components/ui/button"
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { authClient } from "@/lib/auth-client"

export function ResetPasswordForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get("token")
  const [error, setError] = useState<string | null>(
    token ? null : "This reset link is missing or invalid."
  )
  const [pending, setPending] = useState(false)

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!token) return

    setError(null)
    setPending(true)

    const form = new FormData(event.currentTarget)
    const newPassword = String(form.get("password") ?? "")

    const { error: resetError } = await authClient.resetPassword({
      newPassword,
      token,
    })

    setPending(false)

    if (resetError) {
      setError(resetError.message ?? "Unable to reset password.")
      return
    }

    router.push("/sign-in")
  }

  return (
    <AuthShell
      title="Choose a new password"
      description="Pick something memorable that only you know."
    >
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <FieldGroup>
          <Field data-invalid={!!error || undefined}>
            <FieldLabel htmlFor="password">New password</FieldLabel>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              disabled={!token}
              aria-invalid={!!error || undefined}
            />
            {error ? <FieldError>{error}</FieldError> : null}
          </Field>
        </FieldGroup>

        <Button
          type="submit"
          size="lg"
          className="w-full"
          disabled={pending || !token}
        >
          {pending ? <Spinner data-icon="inline-start" /> : null}
          Update password
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
    </AuthShell>
  )
}
