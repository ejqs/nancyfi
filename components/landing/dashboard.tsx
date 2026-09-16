"use client"

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

export function Dashboard({
  name,
  email,
}: {
  name: string
  email: string
}) {
  const router = useRouter()

  async function handleSignOut() {
    await authClient.signOut()
    router.refresh()
  }

  return (
    <div className="flex flex-1 flex-col">
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-5">
        <p className="text-sm font-semibold tracking-tight">Nancyfi</p>
        <Button variant="ghost" size="sm" onClick={handleSignOut}>
          Sign out
        </Button>
      </header>

      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-6 pb-16">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">
            Welcome back{name ? `, ${name}` : ""}
          </h1>
          <p className="text-sm text-muted-foreground">{email}</p>
        </div>

        <Card className="max-w-lg">
          <CardHeader>
            <CardTitle>Your budgets</CardTitle>
            <CardDescription>
              Budget tools are coming next. You are signed in and ready.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-xs/relaxed text-muted-foreground">
              This dashboard replaces the marketing page while you are signed
              in.
            </p>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
