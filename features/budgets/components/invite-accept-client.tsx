"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { authClient } from "@/lib/auth-client"

import { acceptBudgetInviteAction } from "../actions"

type InviteAcceptClientProps = {
  token: string
  budgetName: string
  invitedEmail: string
  status: "pending" | "accepted" | "cancelled" | "expired"
  signedIn: boolean
  signedInEmail: string | null
  emailMatches: boolean
}

const statusLabel: Record<InviteAcceptClientProps["status"], string> = {
  pending: "Waiting for you",
  accepted: "Accepted",
  cancelled: "Cancelled",
  expired: "Expired",
}

export function InviteAcceptClient({
  token,
  budgetName,
  invitedEmail,
  status,
  signedIn,
  signedInEmail,
  emailMatches,
}: InviteAcceptClientProps) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const [signingOut, setSigningOut] = useState(false)

  function handleAccept() {
    setError(null)
    startTransition(async () => {
      const result = await acceptBudgetInviteAction({ token })
      if (!result.ok) {
        setError(result.error)
        return
      }
      router.push(`/budgets/${result.data.budgetId}`)
      router.refresh()
    })
  }

  async function handleSignOut() {
    setSigningOut(true)
    await authClient.signOut()
    router.refresh()
  }

  const canAccept = signedIn && emailMatches && status === "pending"
  const invitePath = `/invites/${token}`
  const signInHref = `/sign-in?next=${encodeURIComponent(invitePath)}`
  const signUpHref = `/sign-up?next=${encodeURIComponent(invitePath)}`

  return (
    <div className="flex flex-1 flex-col">
      <header className="mx-auto flex w-full max-w-lg items-center justify-between px-6 py-5">
        <p className="text-sm font-semibold tracking-tight">Nancyfi</p>
      </header>
      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col px-6 pb-16">
        <Card>
          <CardHeader>
            <CardTitle>Budget invitation</CardTitle>
            <CardDescription>
              Join “{budgetName}” as a contributor.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <dl className="grid gap-2 text-sm">
              <div>
                <dt className="text-xs text-muted-foreground">Invited email</dt>
                <dd>{invitedEmail}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Status</dt>
                <dd>{statusLabel[status]}</dd>
              </div>
            </dl>

            {!signedIn ? (
              <div className="flex flex-col gap-2">
                <p className="text-sm text-muted-foreground">
                  Sign in with {invitedEmail} to accept.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button render={<Link href={signInHref} />} nativeButton={false}>
                    Sign in
                  </Button>
                  <Button
                    variant="outline"
                    render={<Link href={signUpHref} />}
                    nativeButton={false}
                  >
                    Sign up
                  </Button>
                </div>
              </div>
            ) : null}

            {signedIn && !emailMatches ? (
              <div className="flex flex-col gap-3">
                <p className="text-sm text-destructive" role="alert">
                  You are signed in as {signedInEmail}. Switch to {invitedEmail}{" "}
                  to accept this invite.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  disabled={signingOut}
                  onClick={() => void handleSignOut()}
                >
                  Sign out
                </Button>
              </div>
            ) : null}

            {status !== "pending" ? (
              <p className="text-sm text-muted-foreground">
                {status === "accepted"
                  ? "This invitation was already accepted."
                  : status === "expired"
                    ? "This invitation has expired. Ask the owner to send a new one."
                    : "This invitation was cancelled. Ask the owner to send a new one."}
                {status === "accepted" ? (
                  <>
                    {" "}
                    <Link href="/" className="underline underline-offset-4">
                      Go to your budgets
                    </Link>
                    .
                  </>
                ) : null}
              </p>
            ) : null}

            {canAccept ? (
              <Button type="button" disabled={pending} onClick={handleAccept}>
                Accept invitation
              </Button>
            ) : null}

            {error ? (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            ) : null}
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
