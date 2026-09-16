"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"

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

export function SignInForm({ nextPath = "/" }: { nextPath?: string }) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setPending(true)

    const form = new FormData(event.currentTarget)
    const email = String(form.get("email") ?? "")
    const password = String(form.get("password") ?? "")

    const { error: signInError } = await authClient.signIn.email({
      email,
      password,
      callbackURL: `${window.location.origin}${nextPath}`,
    })

    setPending(false)

    if (signInError) {
      setError(signInError.message ?? "Unable to sign in.")
      return
    }

    router.push(nextPath)
    router.refresh()
  }

  return (
    <AuthShell
      title="Welcome to Nancyfi"
      description="Sign in with your email to continue budgeting."
    >
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
          </Field>
          <Field data-invalid={!!error || undefined}>
            <div className="flex items-center justify-between gap-2">
              <FieldLabel htmlFor="password">Password</FieldLabel>
              <Link
                href="/forgot-password"
                className="text-xs/relaxed text-muted-foreground underline-offset-4 hover:underline"
              >
                Forgot password?
              </Link>
            </div>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              aria-invalid={!!error || undefined}
            />
            {error ? <FieldError>{error}</FieldError> : null}
          </Field>
        </FieldGroup>

        <Button type="submit" size="lg" className="w-full" disabled={pending}>
          {pending ? <Spinner data-icon="inline-start" /> : null}
          Sign in
        </Button>

        <p className="text-center text-xs/relaxed text-muted-foreground">
          Don&apos;t have an account?{" "}
          <Link
            href={
              nextPath && nextPath !== "/"
                ? `/sign-up?next=${encodeURIComponent(nextPath)}`
                : "/sign-up"
            }
            className="text-foreground underline-offset-4 hover:underline"
          >
            Sign up
          </Link>
        </p>
      </form>
    </AuthShell>
  )
}
