"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"

import { AppShell } from "@/components/app-shell"
import { Button } from "@/components/ui/button"
import { authClient } from "@/lib/auth-client"

import { listBudgetsAction, type BudgetListItem } from "../actions"
import type { BudgetMembershipRole } from "@/schema/budget"
import { BudgetRepoProvider } from "../repo/repo-provider"
import { SyncStatusIndicator } from "./sync-status-indicator"
import {
  BudgetWorkspace,
  WORKSPACE_SECTIONS,
  type WorkspaceSection,
} from "./budget-workspace"

export function BudgetDetailClient({
  budgetId,
  automergeUrl,
  role,
  catalogName,
  userName,
  userId,
}: {
  budgetId: string
  automergeUrl: string
  role: BudgetMembershipRole
  catalogName: string
  userName: string
  userId: string
}) {
  const router = useRouter()
  const [section, setSection] = useState<WorkspaceSection>("home")
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
  }, [budgetId])

  async function handleSignOut() {
    await authClient.signOut()
    router.refresh()
  }

  return (
    <BudgetRepoProvider>
      <AppShell
        title={catalogName}
        subtitle={userName ? `${userName} · Shared budget` : "Shared budget"}
        budgets={budgets.map((budget) => ({
          id: budget.id,
          name: budget.name,
          href: `/budgets/${budget.id}`,
          active: budget.id === budgetId,
        }))}
        sectionNav={WORKSPACE_SECTIONS.map((item) => ({
          id: item.id,
          label: item.label,
          active: item.id === section,
          onSelect: () => setSection(item.id),
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
        <BudgetWorkspace
          budgetId={budgetId}
          automergeUrl={automergeUrl}
          role={role}
          catalogName={catalogName}
          currentUserId={userId}
          section={section}
          onSectionChange={setSection}
        />
      </AppShell>
    </BudgetRepoProvider>
  )
}
