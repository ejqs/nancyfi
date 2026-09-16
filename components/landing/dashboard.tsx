"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"

import { AppShell } from "@/components/app-shell"
import { Button } from "@/components/ui/button"
import { authClient } from "@/lib/auth-client"
import { BudgetListPanel } from "@/features/budgets/components/budget-list-panel"
import { SyncStatusIndicator } from "@/features/budgets/components/sync-status-indicator"
import { BudgetRepoProvider } from "@/features/budgets/repo/repo-provider"
import {
  listBudgetsAction,
  type BudgetListItem,
} from "@/features/budgets/actions"

export function Dashboard({
  name,
  email,
}: {
  name: string
  email: string
}) {
  const router = useRouter()
  const [budgets, setBudgets] = useState<BudgetListItem[]>([])

  useEffect(() => {
    let cancelled = false
    void listBudgetsAction().then((result) => {
      if (cancelled || !result.ok) return
      setBudgets(result.data)
    })
    return () => {
      cancelled = true
    }
  }, [])

  async function handleSignOut() {
    await authClient.signOut()
    router.refresh()
  }

  return (
    <BudgetRepoProvider>
      <AppShell
        title={`Welcome back${name ? `, ${name}` : ""}`}
        subtitle={email}
        budgets={budgets.map((budget) => ({
          id: budget.id,
          name: budget.name,
          href: `/budgets/${budget.id}`,
        }))}
        headerActions={
          <>
            <SyncStatusIndicator />
            <Button variant="ghost" size="sm" onClick={handleSignOut}>
              Sign out
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <div>
            <h2 className="text-sm font-medium">Your budgets</h2>
            <p className="text-xs text-muted-foreground">
              Create a budget, invite others, and keep editing even offline.
            </p>
          </div>
          <BudgetListPanel
            onBudgetsChange={setBudgets}
          />
        </div>
      </AppShell>
    </BudgetRepoProvider>
  )
}
