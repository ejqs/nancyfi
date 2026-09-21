/**
 * Nested spreadsheet row models for Recurring / Debts / Payday.
 * Importable without Next.js or React — hosts render with TanStack Table.
 */

import {
  listDebtDetails,
  listPaydayPlans,
  subscriptionBurnMinor,
  totalDebtRemainingMinor,
} from "./balances"
import {
  entryAmountMinor,
  isPaydayParentEntry,
  listChildEntries,
  listEntriesForPlan,
  paydayDateFromParentId,
  paydayParentEntryId,
} from "./entry-tree"
import { formatMinor } from "./money-format"
import { planSetupIssue } from "./scenario-commands"
import { expandSchedule } from "./schedule"
import type { BudgetDoc, Entry, Plan } from "./types"

export type NestedSheetKind = "recurring" | "debts" | "payday"

export type NestedSheetRow = {
  id: string
  title: string
  amountLabel: string
  amountMinor: number
  statusLabel: string
  statusTone: "proposed" | "posted" | "void" | "active" | "muted"
  meta: string
  children: NestedSheetRow[]
  planId?: string
  entryId?: string
  paydayDate?: string
  canConfirm?: boolean
}

export type NestedSheet = {
  kind: NestedSheetKind
  title: string
  description: string
  rows: NestedSheetRow[]
  summaryLabel: string
}

function localToday(): string {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, "0")
  const d = String(now.getDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

function daysAhead(from: string, days: number): string {
  const date = new Date(`${from}T12:00:00`)
  date.setDate(date.getDate() + days)
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, "0")
  const d = String(date.getDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

function nextOccurrence(plan: Plan, from = localToday()): string {
  if (!plan.schedule) return "No schedule"
  try {
    const occurrences = expandSchedule(plan.schedule, {
      from,
      to: daysAhead(from, 65),
    })
    return occurrences[0]?.date ?? "No upcoming date"
  } catch {
    return "Schedule unavailable"
  }
}

function formulaLabel(plan: Plan, currency: string): string {
  const formula = plan.amountOrFormula
  if (formula.type === "fixed") {
    return formatMinor(formula.money.amountMinor, formula.money.currency)
  }
  if (formula.type === "percent") {
    return `${(formula.percentBps / 100).toFixed(2)}%`
  }
  if (formula.type === "remainingBalance") return "Remaining balance"
  return currency
}

function entryRow(entry: Entry): NestedSheetRow {
  const amount = entryAmountMinor(entry)
  const currency = entry.postings[0]?.money.currency ?? ""
  return {
    id: entry.id,
    title: entry.description,
    amountLabel: currency ? formatMinor(amount, currency) : "—",
    amountMinor: amount,
    statusLabel:
      entry.status === "proposed"
        ? "needs review"
        : entry.status === "posted"
          ? "posted"
          : "void",
    statusTone:
      entry.status === "proposed"
        ? "proposed"
        : entry.status === "posted"
          ? "posted"
          : "void",
    meta: entry.effectiveAt.slice(0, 10),
    children: [],
    entryId: entry.id,
    canConfirm: entry.status === "proposed" && entry.postings.length > 0,
  }
}

function planChildRows(doc: BudgetDoc, plan: Plan): NestedSheetRow[] {
  return listEntriesForPlan(doc, plan.id)
    .filter((entry) => entry.status !== "void")
    .map(entryRow)
}

function recurringPlanRow(doc: BudgetDoc, plan: Plan): NestedSheetRow {
  const setup = planSetupIssue(doc, plan)
  const children = planChildRows(doc, plan)
  return {
    id: `plan:${plan.id}`,
    title: plan.name,
    amountLabel: setup ? "—" : formulaLabel(plan, doc.defaultCurrency),
    amountMinor:
      !setup && plan.amountOrFormula.type === "fixed"
        ? plan.amountOrFormula.money.amountMinor
        : 0,
    statusLabel: setup ? "Finish setup" : plan.status,
    statusTone: setup || plan.status !== "active" ? "muted" : "active",
    meta: setup ? setup : `next ${nextOccurrence(plan)}`,
    children,
    planId: plan.id,
  }
}

export function buildRecurringSheet(doc: BudgetDoc): NestedSheet {
  const currency = doc.defaultCurrency
  const plans = Object.values(doc.plansById ?? {})
    .filter(
      (plan) =>
        plan.kind === "income" ||
        plan.kind === "subscription" ||
        plan.kind === "allocation",
    )
    .sort((a, b) => a.name.localeCompare(b.name))

  const burn = subscriptionBurnMinor(doc)
  return {
    kind: "recurring",
    title: "Recurring",
    description:
      "Salary, bills, and savings. Expand a row for generated entries — posted credits are not duplicated here.",
    summaryLabel: `Subscription burn ${formatMinor(burn, currency)} (posted)`,
    rows: plans.map((plan) => recurringPlanRow(doc, plan)),
  }
}

export function buildDebtsSheet(doc: BudgetDoc): NestedSheet {
  const currency = doc.defaultCurrency
  const details = listDebtDetails(doc)
  const remaining = totalDebtRemainingMinor(doc)
  const byPlanId = new Map(details.map((row) => [row.plan.id, row]))
  const plans = Object.values(doc.plansById ?? {})
    .filter((plan) => plan.kind === "repayment")
    .sort((a, b) => a.name.localeCompare(b.name))

  return {
    kind: "debts",
    title: "Debts",
    description:
      "Remaining balances are derived from posted liability history, not a second stored amount.",
    summaryLabel: `Remaining ${formatMinor(remaining, currency)}`,
    rows: plans.map((plan) => {
      const setup = planSetupIssue(doc, plan)
      const debt = byPlanId.get(plan.id)
      const children = planChildRows(doc, plan)
      return {
        id: `plan:${plan.id}`,
        title: plan.name,
        amountLabel: debt
          ? formatMinor(debt.remainingMinor, debt.currency)
          : "—",
        amountMinor: debt?.remainingMinor ?? 0,
        statusLabel: setup ? "Finish setup" : plan.status,
        statusTone: setup || plan.status !== "active" ? "muted" : "active",
        meta: setup
          ? setup
          : debt
            ? `paid ${formatMinor(debt.paidMinor, debt.currency)} · next ${nextOccurrence(plan)}`
            : `next ${nextOccurrence(plan)}`,
        children,
        planId: plan.id,
      }
    }),
  }
}

function paydayChildrenAmountMinor(children: NestedSheetRow[]): number {
  return children.reduce((sum, child) => sum + child.amountMinor, 0)
}

function paydayParentRow(doc: BudgetDoc, parent: Entry): NestedSheetRow {
  const date = paydayDateFromParentId(parent.id) ?? parent.effectiveAt.slice(0, 10)
  const children = listChildEntries(doc, parent.id)
    .filter((entry) => entry.status !== "void")
    .map(entryRow)
  const proposed = children.filter((row) => row.canConfirm).length
  const amountMinor = paydayChildrenAmountMinor(children)
  return {
    id: parent.id,
    title: parent.description,
    amountLabel: formatMinor(amountMinor, doc.defaultCurrency),
    amountMinor,
    statusLabel:
      proposed > 0 ? `${proposed} need review` : "confirmed",
    statusTone: proposed > 0 ? "proposed" : "posted",
    meta: date,
    children,
    entryId: parent.id,
    paydayDate: date,
    canConfirm: proposed > 0,
  }
}

function upcomingPaydayDates(doc: BudgetDoc): string[] {
  const from = localToday()
  const to = daysAhead(from, 45)
  const dates = new Set<string>()
  for (const plan of listPaydayPlans(doc)) {
    if (planSetupIssue(doc, plan) || !plan.schedule) continue
    try {
      for (const occ of expandSchedule(plan.schedule, { from, to })) {
        dates.add(occ.date)
      }
    } catch {
      // skip broken schedules
    }
  }
  return [...dates].sort()
}

export function buildPaydaySheet(doc: BudgetDoc): NestedSheet {
  const currency = doc.defaultCurrency
  const parentRows = Object.values(doc.entriesById ?? {})
    .filter(isPaydayParentEntry)
    .filter((entry) => entry.status !== "void")
    .sort((a, b) => a.effectiveAt.localeCompare(b.effectiveAt))
    .map((entry) => paydayParentRow(doc, entry))

  const knownDates = new Set(
    parentRows.map((row) => row.paydayDate).filter(Boolean),
  )
  const upcoming = upcomingPaydayDates(doc)
    .filter((date) => !knownDates.has(date))
    .map((date) => {
      const due = listPaydayPlans(doc).filter((plan) => {
        if (planSetupIssue(doc, plan) || !plan.schedule) return false
        try {
          return expandSchedule(plan.schedule, { from: date, to: date }).length > 0
        } catch {
          return false
        }
      })
      return {
        id: paydayParentEntryId(date),
        title: `Payday ${date}`,
        amountLabel: "—",
        amountMinor: 0,
        statusLabel: "not prepared",
        statusTone: "muted" as const,
        meta: `${due.length} items due`,
        children: due.map((plan) => ({
          id: `upcoming:${date}:${plan.id}`,
          title: plan.name,
          amountLabel: formulaLabel(plan, currency),
          amountMinor:
            plan.amountOrFormula.type === "fixed"
              ? plan.amountOrFormula.money.amountMinor
              : 0,
          statusLabel: plan.kind,
          statusTone: "muted" as const,
          meta: "Prepare to nest under payday",
          children: [],
          planId: plan.id,
        })),
        paydayDate: date,
        canConfirm: false,
      } satisfies NestedSheetRow
    })

  const rows = [...parentRows, ...upcoming].sort((a, b) =>
    (a.paydayDate ?? "").localeCompare(b.paydayDate ?? ""),
  )

  const needsReview = parentRows.reduce(
    (sum, row) => sum + row.children.filter((child) => child.canConfirm).length,
    0,
  )

  return {
    kind: "payday",
    title: "Payday",
    description:
      "Proposed salary and commitments nest under a payday parent. Confirm to post (NAN-19).",
    summaryLabel:
      needsReview > 0
        ? `${needsReview} proposed ${needsReview === 1 ? "entry needs" : "entries need"} review`
        : "No proposed payday entries",
    rows,
  }
}
