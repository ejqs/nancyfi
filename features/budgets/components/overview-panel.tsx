"use client"

import { useState } from "react"

import { Button } from "@/components/ui/button"
import { formatMinor } from "../money-format"
import {
  listAccountBalances,
  listPaydayPlans,
} from "../balances"
import { planSetupIssue } from "../scenario-commands"
import { expandSchedule } from "../schedule"
import type { BudgetDoc, Plan } from "../types"
import type { WorkspaceSection } from "./section-tabs"
import {
  ListRow,
  RowMeta,
  RowTitle,
  StatusDot,
} from "./list-row"

type OverviewPanelProps = {
  doc: BudgetDoc
  onNavigate: (section: WorkspaceSection) => void
  onAddTransaction: () => void
  onOpenSettings: () => void
}

export function OverviewPanel({
  doc,
  onNavigate,
  onAddTransaction,
  onOpenSettings,
}: OverviewPanelProps) {
  const [setupDismissed, setSetupDismissed] = useState(() =>
    typeof window === "undefined"
      ? true
      : window.localStorage.getItem(
          `nancyfi:setup-dismissed:${doc.id}`,
        ) === "true",
  )
  const review = Object.values(doc.entriesById ?? {})
    .filter((entry) => entry.status === "proposed")
    .sort((a, b) => a.effectiveAt.localeCompare(b.effectiveAt))
    .slice(0, 5)
  const balances = listAccountBalances(doc)
    .filter(
      (row) =>
        row.account.kind === "asset" || row.account.kind === "liability",
    )
    .slice(0, 6)
  const upcoming = Object.values(doc.plansById ?? {})
    .filter(
      (plan) =>
        plan.status === "active" &&
        plan.kind !== "income" &&
        !planSetupIssue(doc, plan),
    )
    .sort((a, b) => nextOccurrence(a).localeCompare(nextOccurrence(b)))
    .slice(0, 5)
  const nextPayday = listPaydayPlans(doc)
    .filter((plan) => plan.kind === "income" && !planSetupIssue(doc, plan))
    .map(nextOccurrence)
    .filter((date) => date !== "No upcoming date")
    .sort()[0]
  const hasMoneyLocation = Object.values(doc.accountsById ?? {}).some(
    (account) => account.status === "active" && account.kind === "asset",
  )
  const hasSalary = Object.values(doc.plansById ?? {}).some(
    (plan) =>
      plan.kind === "income" &&
      plan.status === "active" &&
      !planSetupIssue(doc, plan),
  )
  const hasCommitment = Object.values(doc.plansById ?? {}).some(
    (plan) =>
      plan.kind !== "income" &&
      plan.status === "active" &&
      !planSetupIssue(doc, plan),
  )
  const setupComplete = hasMoneyLocation && hasSalary && hasCommitment

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-medium">Home</h2>
          <p className="text-xs text-muted-foreground">
            What needs attention and what is coming next.
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          onClick={onAddTransaction}
        >
          Add transaction
        </Button>
      </div>

      {!setupComplete && !setupDismissed ? (
        <section className="flex flex-col gap-3 rounded-md border border-border p-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-medium">Finish setting up</h3>
              <p className="text-xs text-muted-foreground">
                Four short steps make payday and balances useful.
              </p>
            </div>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => {
                window.localStorage.setItem(
                  `nancyfi:setup-dismissed:${doc.id}`,
                  "true",
                )
                setSetupDismissed(true)
              }}
            >
              Skip setup
            </Button>
          </div>
          <ol className="flex flex-col gap-2">
            <SetupStep
              done={hasMoneyLocation}
              label="Where money lives"
              description="Add the bank or cash account you use."
              action="Add money location"
              onClick={onOpenSettings}
            />
            <SetupStep
              done={hasSalary}
              label="Salary"
              description="Set the typical amount and deposit account."
              action="Add salary"
              onClick={() => onNavigate("recurring")}
            />
            <SetupStep
              done={hasCommitment}
              label="Regular commitments"
              description="Add a bill, savings transfer, or debt repayment."
              action="Add commitment"
              onClick={() => onNavigate("recurring")}
            />
            <SetupStep
              done={review.length === 0}
              label="Review"
              description="Confirm anything Nancyfi prepared."
              action="Review transactions"
              onClick={() => onNavigate("transactions")}
            />
          </ol>
        </section>
      ) : null}

      <section className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-medium">Next payday</h3>
            <p className="text-xs text-muted-foreground">
              {nextPayday ?? "Add salary to see the next payday."}
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              onNavigate(nextPayday ? "payday" : "recurring")
            }
          >
            {nextPayday ? "Review payday" : "Add salary"}
          </Button>
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium">Needs review</h3>
          {review.length > 0 ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onNavigate("transactions")}
            >
              Review all
            </Button>
          ) : null}
        </div>
        {review.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            You are caught up. Prepared items will appear here.
          </p>
        ) : (
          <div className="rounded-md border border-border/80">
            {review.map((entry) => (
              <ListRow key={entry.id}>
                <StatusDot tone="proposed" label="needs review" />
                <RowTitle>{entry.description}</RowTitle>
                <RowMeta>{entry.effectiveAt.slice(0, 10)}</RowMeta>
              </ListRow>
            ))}
          </div>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium">Upcoming commitments</h3>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onNavigate("recurring")}
          >
            View recurring
          </Button>
        </div>
        {upcoming.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            Add bills, subscriptions, savings, or debt repayments.
          </p>
        ) : (
          <div className="rounded-md border border-border/80">
            {upcoming.map((plan) => (
              <ListRow key={plan.id}>
                <StatusDot tone="muted" label={plan.kind} />
                <RowTitle>{plan.name}</RowTitle>
                <RowMeta>
                  {nextOccurrence(plan)} · {planAmount(plan)}
                </RowMeta>
              </ListRow>
            ))}
          </div>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium">Balances</h3>
        </div>
        {balances.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            Add a bank, cash account, or debt in Settings.
          </p>
        ) : (
          <div className="rounded-md border border-border/80">
            {balances.map((row) => (
              <ListRow key={row.account.id}>
                <StatusDot tone="muted" label={row.account.kind} />
                <RowTitle>{row.account.name}</RowTitle>
                <RowMeta>
                  {row.account.kind === "liability"
                    ? `${formatMinor(Math.abs(row.balanceMinor), row.currency)} owed`
                    : formatMinor(row.balanceMinor, row.currency)}
                </RowMeta>
              </ListRow>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

function localDate(offsetDays = 0): string {
  const date = new Date()
  date.setDate(date.getDate() + offsetDays)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

function nextOccurrence(plan: Plan): string {
  if (!plan.schedule) return "No upcoming date"
  try {
    return (
      expandSchedule(plan.schedule, {
        from: localDate(),
        to: localDate(60),
      })[0]?.date ?? "No upcoming date"
    )
  } catch {
    return "No upcoming date"
  }
}

function planAmount(plan: Plan): string {
  const formula = plan.amountOrFormula
  if (formula.type === "fixed") {
    return formatMinor(formula.money.amountMinor, formula.money.currency)
  }
  if (formula.type === "percent") {
    return `${formula.percentBps / 100}%`
  }
  return "Calculated at payday"
}

function SetupStep({
  done,
  label,
  description,
  action,
  onClick,
}: {
  done: boolean
  label: string
  description: string
  action: string
  onClick: () => void
}) {
  return (
    <li className="flex items-center justify-between gap-3 rounded-md bg-muted/40 px-3 py-2">
      <div>
        <p className="text-xs font-medium">
          {done ? "Done · " : ""}
          {label}
        </p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      {!done ? (
        <Button type="button" size="sm" variant="outline" onClick={onClick}>
          {action}
        </Button>
      ) : null}
    </li>
  )
}
