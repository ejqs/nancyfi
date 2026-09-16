"use client"

import { useState } from "react"
import type { ChangeFn } from "@automerge/automerge/slim"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { formatMinor, parseMajorToMinor } from "../money-format"
import {
  listActiveSubscriptionPlans,
  listDebtBoard,
  listPaydayPlans,
} from "../balances"
import { applyUpsertEntry } from "../mutations"
import { applyProposePlanOccurrences } from "../plan-propose"
import { planSetupIssue } from "../scenario-commands"
import { expandSchedule } from "../schedule"
import type { BudgetDoc, Entry, Plan } from "../types"
import {
  ListRow,
  RowActions,
  RowMeta,
  RowTitle,
  StatusDot,
} from "./list-row"

function formulaHint(plan: Plan, currency: string): string {
  const f = plan.amountOrFormula
  if (f.type === "fixed") {
    return formatMinor(f.money.amountMinor, f.money.currency)
  }
  if (f.type === "percent") {
    return `${(f.percentBps / 100).toFixed(2)}%`
  }
  if (f.type === "remainingBalance") {
    return "Remaining balance"
  }
  return currency
}

function calendarRange(daysAhead: number): { from: string; to: string } {
  const today = new Date()
  const end = new Date(today)
  end.setDate(end.getDate() + daysAhead)
  const fmt = (d: Date) => {
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, "0")
    const day = String(d.getDate()).padStart(2, "0")
    return `${y}-${m}-${day}`
  }
  return { from: fmt(today), to: fmt(end) }
}

function nextOccurrenceLabel(plan: Plan): string {
  if (!plan.schedule) return "No schedule"
  try {
    const range = calendarRange(45)
    const occurrences = expandSchedule(plan.schedule, range)
    return occurrences[0]?.date ?? "No upcoming date"
  } catch {
    return "Schedule unavailable"
  }
}

type BoardProps = {
  doc: BudgetDoc
  changeDoc: (changeFn: ChangeFn<BudgetDoc>) => void
  onOpenRecurring?: () => void
}

export function PaydayBoard({
  doc,
  changeDoc,
  onOpenRecurring,
}: BoardProps) {
  const plans = listPaydayPlans(doc)
  const validPlans = plans.filter((plan) => !planSetupIssue(doc, plan))
  const incompletePlans = plans.filter((plan) => planSetupIssue(doc, plan))
  const targetDate = validPlans
    .map(nextOccurrenceLabel)
    .filter(
      (date) => date !== "No upcoming date" && date !== "Schedule unavailable",
    )
    .sort()[0]
  const duePlans = validPlans.filter(
    (plan) => nextOccurrenceLabel(plan) === targetDate,
  )
  const salaryPlan = duePlans.find((plan) => plan.kind === "income")
  const expectedSalary =
    salaryPlan?.amountOrFormula.type === "fixed"
      ? salaryPlan.amountOrFormula.money.amountMinor
      : null
  const [actualSalary, setActualSalary] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const salaryInput =
    actualSalary ??
    (expectedSalary !== null ? String(expectedSalary / 100) : "")
  const prepared = Object.values(doc.entriesById ?? {})
    .filter(
      (entry) =>
        entry.status === "proposed" &&
        entry.sourcePlanOccurrenceId &&
        duePlans.some((plan) =>
          entry.sourcePlanOccurrenceId?.startsWith(`${plan.id}:`),
        ) &&
        entry.effectiveAt.slice(0, 10) === targetDate,
    )
    .sort((a, b) => a.description.localeCompare(b.description))

  function parsedActualSalary(): number | undefined {
    if (!salaryPlan) return undefined
    return parseMajorToMinor(salaryInput)
  }

  function preparePayday() {
    if (!targetDate) return
    try {
      const actualMinor = parsedActualSalary()
      changeDoc((draft) => {
        for (const plan of duePlans) {
          applyProposePlanOccurrences(draft, {
            planId: plan.id,
            range: { from: targetDate, to: targetDate },
            ...(plan.id === salaryPlan?.id && actualMinor
              ? { amountMinorOverride: actualMinor }
              : {}),
            ...(plan.amountOrFormula.type === "percent" && actualMinor
              ? { baseAmountMinor: actualMinor }
              : {}),
          })
        }
      })
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not prepare payday")
    }
  }

  function confirm(entry: Entry) {
    changeDoc((draft) => {
      applyUpsertEntry(draft, {
        id: entry.id,
        description: entry.description,
        effectiveAt: entry.effectiveAt,
        status: "posted",
        postings: entry.postings.map((posting) => ({
          accountId: posting.accountId,
          money: {
            amountMinor: posting.money.amountMinor,
            currency: posting.money.currency,
          },
          ...(posting.role ? { role: posting.role } : {}),
        })),
        ...(entry.sourcePlanOccurrenceId
          ? { sourcePlanOccurrenceId: entry.sourcePlanOccurrenceId }
          : {}),
      })
    })
  }

  function confirmAll() {
    changeDoc((draft) => {
      for (const entry of prepared) {
        applyUpsertEntry(draft, {
          id: entry.id,
          description: entry.description,
          effectiveAt: entry.effectiveAt,
          status: "posted",
          postings: entry.postings.map((posting) => ({
            accountId: posting.accountId,
            money: {
              amountMinor: posting.money.amountMinor,
              currency: posting.money.currency,
            },
            ...(posting.role ? { role: posting.role } : {}),
          })),
          ...(entry.sourcePlanOccurrenceId
            ? { sourcePlanOccurrenceId: entry.sourcePlanOccurrenceId }
            : {}),
        })
      }
    })
  }

  const actualMinor = Number.isFinite(Number(salaryInput))
    ? Math.round(Number(salaryInput) * 100)
    : 0
  const predictedCommitments = duePlans
    .filter((plan) => plan.kind !== "income")
    .reduce((sum, plan) => {
      if (plan.amountOrFormula.type === "fixed") {
        return sum + plan.amountOrFormula.money.amountMinor
      }
      if (plan.amountOrFormula.type === "percent") {
        return (
          sum +
          Math.trunc(
            (actualMinor * plan.amountOrFormula.percentBps) / 10_000,
          )
        )
      }
      return sum
    }, 0)
  const afterCommitments = actualMinor - predictedCommitments

  function itemAmount(plan: Plan): string {
    if (plan.id === salaryPlan?.id && actualMinor > 0) {
      return formatMinor(actualMinor, doc.defaultCurrency)
    }
    if (plan.amountOrFormula.type === "percent" && actualMinor > 0) {
      return formatMinor(
        Math.trunc(
          (actualMinor * plan.amountOrFormula.percentBps) / 10_000,
        ),
        doc.defaultCurrency,
      )
    }
    return formulaHint(plan, doc.defaultCurrency)
  }

  return (
    <section className="flex flex-col gap-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-medium">Payday</h2>
          <p className="text-xs text-muted-foreground">
            {targetDate
              ? `Prepare and review ${targetDate} before confirming.`
              : "Add salary and commitments to prepare a payday."}
          </p>
        </div>
        {targetDate ? (
          <Button type="button" size="sm" onClick={preparePayday}>
            Prepare payday
          </Button>
        ) : (
          <Button
            type="button"
            size="sm"
            onClick={onOpenRecurring}
          >
            Add recurring
          </Button>
        )}
      </div>

      {incompletePlans.length > 0 ? (
        <div className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2">
          <p className="text-xs text-muted-foreground">
            {incompletePlans.length} recurring{" "}
            {incompletePlans.length === 1 ? "item needs" : "items need"} setup
            before it can join payday.
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onOpenRecurring}
          >
            Finish setup
          </Button>
        </div>
      ) : null}

      {salaryPlan ? (
        <div className="flex flex-col gap-2 rounded-md border border-border p-3">
          <div>
            <h3 className="text-sm font-medium">Actual salary</h3>
            <p className="text-xs text-muted-foreground">
              Expected{" "}
              {expectedSalary !== null
                ? formatMinor(expectedSalary, doc.defaultCurrency)
                : "amount unavailable"}
              . Change this payday only; the recurring amount stays the same.
            </p>
          </div>
          <Input
            aria-label={`Actual salary in ${doc.defaultCurrency}`}
            inputMode="decimal"
            value={salaryInput}
            onChange={(event) => setActualSalary(event.target.value)}
            className="max-w-48"
          />
        </div>
      ) : null}

      {targetDate ? (
        <div className="flex flex-col gap-2">
          <div>
            <h3 className="text-xs font-medium text-muted-foreground">
              Expected commitments
            </h3>
            {salaryPlan ? (
              <p className="text-xs text-muted-foreground">
                After commitments:{" "}
                {formatMinor(afterCommitments, doc.defaultCurrency)}
              </p>
            ) : null}
          </div>
          <div className="rounded-md border border-border/80">
            {duePlans.map((plan) => (
              <ListRow key={plan.id}>
                <StatusDot
                  tone={plan.kind === "income" ? "active" : "muted"}
                  label={plan.kind}
                />
                <RowTitle>{plan.name}</RowTitle>
                <RowMeta>{itemAmount(plan)}</RowMeta>
              </ListRow>
            ))}
          </div>
        </div>
      ) : null}

      {prepared.length > 0 ? (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-medium">Needs review</h3>
              <p className="text-xs text-muted-foreground">
                Confirm all, or confirm one item at a time.
              </p>
            </div>
            <Button type="button" size="sm" onClick={confirmAll}>
              Confirm all
            </Button>
          </div>
          <div className="rounded-md border border-border/80">
            {prepared.map((entry) => (
              <ListRow key={entry.id}>
                <StatusDot tone="proposed" label="needs review" />
                <RowTitle>{entry.description}</RowTitle>
                <RowMeta>
                  {entry.postings[0]
                    ? formatMinor(
                        Math.abs(entry.postings[0].money.amountMinor),
                        entry.postings[0].money.currency,
                      )
                    : "—"}
                </RowMeta>
                <RowActions>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => confirm(entry)}
                  >
                    Confirm
                  </Button>
                </RowActions>
              </ListRow>
            ))}
          </div>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          {targetDate
            ? "Nothing prepared yet. Check the salary amount, then prepare payday."
            : "No scheduled items are ready."}
        </p>
      )}
      {error ? (
        <p className="text-xs text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  )
}

export function SubscriptionsBoard({ doc }: { doc: BudgetDoc }) {
  const plans = listActiveSubscriptionPlans(doc)
  return (
    <section className="flex flex-col gap-3">
      <div>
        <h2 className="text-sm font-medium">Subscriptions</h2>
        <p className="text-xs text-muted-foreground">
          Active subscription plans. Cancelled plans stay out of this list.
        </p>
      </div>
      {plans.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          No active subscriptions. Create a subscription plan to track them.
        </p>
      ) : (
        <div className="rounded-md border border-border/80">
          {plans.map((plan) => (
            <ListRow key={plan.id}>
              <StatusDot tone="active" label="subscription" />
              <RowTitle>{plan.name}</RowTitle>
              <RowMeta>{formulaHint(plan, doc.defaultCurrency)}</RowMeta>
            </ListRow>
          ))}
        </div>
      )}
    </section>
  )
}

export function DebtBoard({ doc }: { doc: BudgetDoc }) {
  const { liabilities, repaymentPlans } = listDebtBoard(doc)
  return (
    <section className="flex flex-col gap-6">
      <div>
        <h2 className="text-sm font-medium">Debt remaining</h2>
        <p className="text-xs text-muted-foreground">
          Liability balances from posted history, plus active repayment plans.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <h3 className="text-xs font-medium text-muted-foreground">
          Liabilities
        </h3>
        {liabilities.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            No liability accounts yet.
          </p>
        ) : (
          <div className="rounded-md border border-border/80">
            {liabilities.map((row) => (
              <ListRow key={row.account.id}>
                <StatusDot tone="muted" label="liability" />
                <RowTitle>{row.account.name}</RowTitle>
                <RowMeta>
                  {formatMinor(row.balanceMinor, row.currency)}
                </RowMeta>
              </ListRow>
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <h3 className="text-xs font-medium text-muted-foreground">
          Repayment plans
        </h3>
        {repaymentPlans.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            No active repayment plans.
          </p>
        ) : (
          <div className="rounded-md border border-border/80">
            {repaymentPlans.map((plan) => (
              <ListRow key={plan.id}>
                <StatusDot tone="active" label="repayment" />
                <RowTitle>{plan.name}</RowTitle>
                <RowMeta>{formulaHint(plan, doc.defaultCurrency)}</RowMeta>
              </ListRow>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
