import { accountPostedBalanceMinor } from "./plan-propose"
import type { Account, BudgetDoc, Entry, Plan } from "./types"

export type AccountBalanceRow = {
  account: Account
  balanceMinor: number
  currency: string
}

/** Active accounts with posted balances (void ignored). */
export function listAccountBalances(doc: BudgetDoc): AccountBalanceRow[] {
  const currency = doc.defaultCurrency
  return Object.values(doc.accountsById ?? {})
    .filter((account) => account.status === "active")
    .sort((a, b) => {
      if (a.kind !== b.kind) return a.kind.localeCompare(b.kind)
      return a.name.localeCompare(b.name)
    })
    .map((account) => ({
      account,
      balanceMinor: accountPostedBalanceMinor(doc, account.id, currency),
      currency,
    }))
}

export function countEntriesByStatus(
  doc: BudgetDoc,
): Record<"proposed" | "posted" | "void", number> {
  const counts = { proposed: 0, posted: 0, void: 0 }
  for (const entry of Object.values(doc.entriesById ?? {})) {
    counts[entry.status] += 1
  }
  return counts
}

export function recentEntries(doc: BudgetDoc, limit = 8): Entry[] {
  return Object.values(doc.entriesById ?? {})
    .slice()
    .sort((a, b) => {
      if (a.effectiveAt !== b.effectiveAt) {
        return b.effectiveAt.localeCompare(a.effectiveAt)
      }
      return a.description.localeCompare(b.description)
    })
    .slice(0, limit)
}

/** Active subscription plans for the subscriptions board. */
export function listActiveSubscriptionPlans(doc: BudgetDoc): Plan[] {
  return Object.values(doc.plansById ?? {})
    .filter((plan) => plan.kind === "subscription" && plan.status === "active")
    .sort((a, b) => a.name.localeCompare(b.name))
}

/** Active repayment plans + liability accounts for debt board. */
export function listDebtBoard(doc: BudgetDoc): {
  liabilities: AccountBalanceRow[]
  repaymentPlans: Plan[]
} {
  const balances = listAccountBalances(doc).filter(
    (row) => row.account.kind === "liability",
  )
  const repaymentPlans = Object.values(doc.plansById ?? {})
    .filter((plan) => plan.kind === "repayment" && plan.status === "active")
    .sort((a, b) => a.name.localeCompare(b.name))
  return { liabilities: balances, repaymentPlans }
}

export type DebtDetail = {
  plan: Plan
  liability: Account
  originalMinor: number
  paidMinor: number
  remainingMinor: number
  currency: string
}

/** Auditable debt totals derived only from posted liability postings. */
export function listDebtDetails(doc: BudgetDoc): DebtDetail[] {
  const currency = doc.defaultCurrency.toUpperCase()
  return Object.values(doc.plansById ?? {})
    .filter((plan) => plan.kind === "repayment" && plan.status !== "cancelled")
    .flatMap((plan) => {
      const liability = doc.accountsById[plan.linkedAccountIds[1]]
      if (!liability || liability.kind !== "liability") return []

      let originalMinor = 0
      let paidMinor = 0
      let signedBalance = 0
      for (const entry of Object.values(doc.entriesById ?? {})) {
        if (entry.status !== "posted") continue
        for (const posting of entry.postings) {
          if (
            posting.accountId !== liability.id ||
            posting.money.currency.toUpperCase() !== currency
          ) {
            continue
          }
          signedBalance += posting.money.amountMinor
          if (posting.money.amountMinor < 0) {
            originalMinor += Math.abs(posting.money.amountMinor)
          } else {
            paidMinor += posting.money.amountMinor
          }
        }
      }

      return [
        {
          plan,
          liability,
          originalMinor,
          paidMinor,
          remainingMinor: Math.abs(signedBalance),
          currency,
        },
      ]
    })
    .sort((a, b) => a.plan.name.localeCompare(b.plan.name))
}

/** Payday-relevant plans: income + allocation with schedules. */
export function listPaydayPlans(doc: BudgetDoc): Plan[] {
  return Object.values(doc.plansById ?? {})
    .filter(
      (plan) =>
        plan.status === "active" &&
        (plan.kind === "income" ||
          plan.kind === "allocation" ||
          plan.kind === "subscription" ||
          plan.kind === "repayment") &&
        plan.schedule,
    )
    .sort((a, b) => a.name.localeCompare(b.name))
}
