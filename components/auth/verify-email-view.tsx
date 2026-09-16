import Link from "next/link"

import { AuthShell } from "@/components/auth/auth-shell"
import { Button } from "@/components/ui/button"

export function VerifyEmailView({
  email,
  nextPath,
}: {
  email?: string
  nextPath?: string
}) {
  const signInHref = nextPath
    ? `/sign-in?next=${encodeURIComponent(nextPath)}`
    : "/sign-in"

  return (
    <AuthShell
      title="Check your email"
      description={
        email
          ? `We sent a verification link to ${email}.`
          : "We sent a verification link to your inbox."
      }
    >
      <div className="flex flex-col gap-4">
        <p className="text-center text-xs/relaxed text-muted-foreground">
          Open the link to verify your account, then sign in.
        </p>
        <Button
          render={<Link href={signInHref} />}
          nativeButton={false}
          size="lg"
          className="w-full"
        >
          Back to sign in
        </Button>
      </div>
    </AuthShell>
  )
}
