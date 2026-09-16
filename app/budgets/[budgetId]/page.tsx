import { notFound, redirect } from "next/navigation"

import { BudgetDetailGate } from "@/features/budgets/components/budget-detail-gate"
import { getMembershipForUser } from "@/features/budgets/db/membership"
import { getCurrentUser } from "@/lib/session"

export default async function BudgetDetailPage({
  params,
}: {
  params: Promise<{ budgetId: string }>
}) {
  const user = await getCurrentUser()
  if (!user) {
    redirect("/sign-in")
  }

  const { budgetId } = await params
  const membership = await getMembershipForUser(budgetId, user.id)
  if (!membership || membership.status === "archived") {
    notFound()
  }

  return (
    <BudgetDetailGate
      budgetId={budgetId}
      automergeUrl={membership.automergeUrl}
      role={membership.role}
      catalogName={membership.name}
      userName={user.name}
      userId={user.id}
    />
  )
}
