"use client"

import dynamic from "next/dynamic"

import type { BudgetMembershipRole } from "../db/schema"

const BudgetDetailClient = dynamic(
  () =>
    import("./budget-detail-client").then((mod) => mod.BudgetDetailClient),
  {
    ssr: false,
    loading: () => (
      <div className="flex flex-1 items-center justify-center p-6 text-sm text-muted-foreground">
        Opening budget…
      </div>
    ),
  },
)

export function BudgetDetailGate({
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
  return (
    <BudgetDetailClient
      budgetId={budgetId}
      automergeUrl={automergeUrl}
      role={role}
      catalogName={catalogName}
      userName={userName}
      userId={userId}
    />
  )
}
