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

export function SignUpForm({ nextPath }: { nextPath?: string }) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setPending(true)

    const form = new FormData(event.currentTarget)
    const name = String(form.get("name") ?? "")
    const email = String(form.get("email") ?? "")
    const password = String(form.get("password") ?? "")

    const callbackPath = nextPath ?? "/"
    const { error: signUpError } = await authClient.signUp.email({
      name,
      email,
      password,
      callbackURL: `${window.location.origin}${callbackPath}`,
    })

    setPending(false)

    if (signUpError) {
      setError(signUpError.message ?? "Unable to create your account.")
      return
    }

    const verifyQs = new URLSearchParams({ email })
    if (nextPath) verifyQs.set("next", nextPath)
    router.push(`/verify-email?${verifyQs.toString()}`)
  }

  return (
    <AuthShell
      title="Create your Nancyfi account"
      description="Start with a simple budget you can shape later."
    >
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <FieldGroup>
          <Field data-invalid={!!error || undefined}>
            <FieldLabel htmlFor="name">Name</FieldLabel>
            <Input
              id="name"
              name="name"
              type="text"
              autoComplete="name"
              required
              placeholder="Your name"
              aria-invalid={!!error || undefined}
            />
          </Field>
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
            <FieldLabel htmlFor="password">Password</FieldLabel>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              aria-invalid={!!error || undefined}
            />
            {error ? <FieldError>{error}</FieldError> : null}
          </Field>
        </FieldGroup>

        <Button type="submit" size="lg" className="w-full" disabled={pending}>
          {pending ? <Spinner data-icon="inline-start" /> : null}
          Create account
        </Button>

        <p className="text-center text-xs/relaxed text-muted-foreground">
          Already have an account?{" "}
          <Link
            href={
              nextPath
                ? `/sign-in?next=${encodeURIComponent(nextPath)}`
                : "/sign-in"
            }
            className="text-foreground underline-offset-4 hover:underline"
          >
            Sign in
          </Link>
        </p>
      </form>
    </AuthShell>
  )
}
