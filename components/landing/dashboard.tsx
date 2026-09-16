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
import { LocalBudgetProbe } from "@/features/budgets/components/local-budget-probe"
import { SyncStatusIndicator } from "@/features/budgets/components/sync-status-indicator"
import { BudgetRepoProvider } from "@/features/budgets/repo/repo-provider"

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
    <BudgetRepoProvider>
      <div className="flex flex-1 flex-col">
        <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-5">
          <p className="text-sm font-semibold tracking-tight">Nancyfi</p>
          <div className="flex items-center gap-3">
            <SyncStatusIndicator />
            <Button variant="ghost" size="sm" onClick={handleSignOut}>
              Sign out
            </Button>
          </div>
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
                Local Automerge store is live. Edits persist in IndexedDB and
                sync across tabs via BroadcastChannel until a remote sync
                server is wired.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <LocalBudgetProbe />
            </CardContent>
          </Card>
        </main>
      </div>
    </BudgetRepoProvider>
  )
}
