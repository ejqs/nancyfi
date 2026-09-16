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

import type { BudgetMembershipRole } from "../db/schema"
import { BudgetRepoProvider } from "../repo/repo-provider"
import { SyncStatusIndicator } from "./sync-status-indicator"
import { BudgetWorkspace } from "./budget-workspace"

export function BudgetDetailClient({
  budgetId,
  automergeUrl,
  role,
  catalogName,
  userName,
}: {
  budgetId: string
  automergeUrl: string
  role: BudgetMembershipRole
  catalogName: string
  userName: string
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
          <div className="flex flex-col gap-1">
            <h1 className="text-2xl font-semibold tracking-tight">
              {catalogName}
            </h1>
            <p className="text-sm text-muted-foreground">
              {userName ? `${userName} · ` : ""}
              Collaborative budget document
            </p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Budget</CardTitle>
              <CardDescription>
                Edits sync locally via Automerge. Membership and archive are
                enforced on the server.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <BudgetWorkspace
                budgetId={budgetId}
                automergeUrl={automergeUrl}
                role={role}
                catalogName={catalogName}
              />
            </CardContent>
          </Card>
        </main>
      </div>
    </BudgetRepoProvider>
  )
}
