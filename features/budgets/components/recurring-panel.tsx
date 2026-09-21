"use client"

import { useState } from "react"
import type { ChangeFn } from "@automerge/automerge/slim"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"

import { listDebtDetails } from "../balances"
import { money } from "../document"
import { parseMajorToMinor } from "../money-format"
import { applyUpsertPlan } from "../mutations"
import {
  applyCreateDebtRepayment,
  applyCreateSalary,
  applyCreateSubscription,
} from "../scenario-commands"
import { createPaydaySchedule } from "../schedule"
import { buildDebtsSheet, buildRecurringSheet } from "../sheets"
import type { BudgetDoc, Plan, Schedule } from "../types"
import { NestedSheetTable } from "./nested-sheet"

type RecurringTask = "salary" | "subscription" | "debt" | "savings"
type Cadence = "payday" | "monthly"

type RecurringPanelProps = {
  doc: BudgetDoc
  changeDoc: (changeFn: ChangeFn<BudgetDoc>) => void
  variant?: "recurring" | "debts"
}

const selectClassName =
  "h-7 w-full rounded-md border border-input bg-input/20 px-2 text-xs outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"

function localDate(): string {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, "0")
  const d = String(now.getDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

function monthlySchedule(timezone: string, startAt: string): Schedule {
  return {
    timezone,
    anchors: ["endOfMonth"],
    adjustToPreviousWeekday: true,
    startAt,
  }
}

function taskForPlan(plan: Plan): RecurringTask {
  if (plan.kind === "income") return "salary"
  if (plan.kind === "subscription") return "subscription"
  if (plan.kind === "repayment") return "debt"
  return "savings"
}

export function RecurringPanel({
  doc,
  changeDoc,
  variant = "recurring",
}: RecurringPanelProps) {
  const [open, setOpen] = useState(false)
  const [editingPlanId, setEditingPlanId] = useState<string | null>(null)
  const [task, setTask] = useState<RecurringTask>("salary")
  const [name, setName] = useState("")
  const [amount, setAmount] = useState("")
  const [originalAmount, setOriginalAmount] = useState("")
  const [startDate, setStartDate] = useState(localDate)
  const [primaryAssetId, setPrimaryAssetId] = useState("")
  const [secondaryAssetId, setSecondaryAssetId] = useState("")
  const [counterpartyName, setCounterpartyName] = useState("")
  const [linkedCounterpartyId, setLinkedCounterpartyId] = useState("")
  const [requiresOriginalAmount, setRequiresOriginalAmount] = useState(false)
  const [cadence, setCadence] = useState<Cadence>("payday")
  const [error, setError] = useState<string | null>(null)

  const assets = Object.values(doc.accountsById ?? {})
    .filter((account) => account.status === "active" && account.kind === "asset")
    .sort((a, b) => a.name.localeCompare(b.name))
  const sheet =
    variant === "debts" ? buildDebtsSheet(doc) : buildRecurringSheet(doc)

  function reset() {
    setEditingPlanId(null)
    setTask(variant === "debts" ? "debt" : "salary")
    setName("")
    setAmount("")
    setOriginalAmount("")
    setStartDate(localDate())
    setPrimaryAssetId("")
    setSecondaryAssetId("")
    setCounterpartyName("")
    setLinkedCounterpartyId("")
    setRequiresOriginalAmount(false)
    setCadence("payday")
    setError(null)
  }

  function close() {
    setOpen(false)
    reset()
  }

  function startCreate(nextTask?: RecurringTask) {
    reset()
    if (nextTask) {
      setTask(nextTask)
      setRequiresOriginalAmount(nextTask === "debt")
    }
    setOpen(true)
  }

  function startEdit(plan: Plan) {
    reset()
    const nextTask = taskForPlan(plan)
    const [fromId, toId] = plan.linkedAccountIds
    setEditingPlanId(plan.id)
    setTask(nextTask)
    setName(plan.name)
    if (plan.amountOrFormula.type === "fixed") {
      setAmount(String(plan.amountOrFormula.money.amountMinor / 100))
    }
    setCadence(
      plan.schedule?.anchors.length === 1 ? "monthly" : "payday",
    )
    setStartDate(plan.schedule?.startAt?.slice(0, 10) ?? localDate())

    if (nextTask === "salary") {
      setPrimaryAssetId(toId ?? "")
      const source = doc.accountsById[fromId]
      setLinkedCounterpartyId(source?.kind === "income" ? source.id : "")
      setCounterpartyName(source?.kind === "income" ? source.name : "")
    } else if (nextTask === "savings") {
      setPrimaryAssetId(fromId ?? "")
      setSecondaryAssetId(toId ?? "")
    } else {
      setPrimaryAssetId(fromId ?? "")
      const target = doc.accountsById[toId]
      const expectedKind = nextTask === "debt" ? "liability" : "expense"
      setLinkedCounterpartyId(target?.kind === expectedKind ? target.id : "")
      setCounterpartyName(target?.kind === expectedKind ? target.name : "")
      if (nextTask === "debt") {
        const currentBalance =
          target?.kind === "liability"
            ? listDebtDetails(doc).find(
                (detail) => detail.liability.id === target.id,
              )?.remainingMinor ?? 0
            : 0
        setRequiresOriginalAmount(currentBalance === 0)
      }
    }
    setOpen(true)
  }

  function schedule(): Schedule {
    return cadence === "payday"
      ? createPaydaySchedule({
          timezone: doc.timezone,
          startAt: startDate,
        })
      : monthlySchedule(doc.timezone, startDate)
  }

  function save(event: React.FormEvent) {
    event.preventDefault()
    if (!name.trim()) {
      setError("Name this recurring item")
      return
    }
    if (!primaryAssetId) {
      setError(
        task === "salary"
          ? "Choose where salary is deposited"
          : "Choose where payment comes from",
      )
      return
    }
    if (task === "savings" && !secondaryAssetId) {
      setError("Choose the savings destination")
      return
    }
    if (task !== "savings" && !counterpartyName.trim()) {
      setError(
        task === "salary"
          ? "Name the income source"
          : task === "debt"
            ? "Name who you owe"
            : "Name the spending category",
      )
      return
    }

    try {
      const amountMinor = parseMajorToMinor(amount)
      const nextSchedule = schedule()
      changeDoc((draft) => {
        if (task === "salary") {
          applyCreateSalary(draft, {
            planId: editingPlanId ?? undefined,
            name,
            amountMinor,
            depositAccountId: primaryAssetId,
            source: linkedCounterpartyId
              ? { accountId: linkedCounterpartyId }
              : { name: counterpartyName },
            schedule: nextSchedule,
          })
          return
        }
        if (task === "subscription") {
          applyCreateSubscription(draft, {
            planId: editingPlanId ?? undefined,
            name,
            amountMinor,
            paymentAccountId: primaryAssetId,
            category: linkedCounterpartyId
              ? { accountId: linkedCounterpartyId }
              : { name: counterpartyName },
            schedule: nextSchedule,
          })
          return
        }
        if (task === "debt") {
          applyCreateDebtRepayment(draft, {
            planId: editingPlanId ?? undefined,
            name,
            paymentAmountMinor: amountMinor,
            paymentAccountId: primaryAssetId,
            liability: linkedCounterpartyId
              ? { accountId: linkedCounterpartyId }
              : { name: counterpartyName },
            ...(!requiresOriginalAmount
              ? {}
              : {
                  originalAmountMinor: parseMajorToMinor(originalAmount),
                  effectiveAt: new Date(
                    `${startDate}T12:00:00`,
                  ).toISOString(),
                }),
            schedule: nextSchedule,
          })
          return
        }
        applyUpsertPlan(draft, {
          id: editingPlanId ?? crypto.randomUUID(),
          name,
          kind: "allocation",
          status: "active",
          amountOrFormula: {
            type: "fixed",
            money: money(amountMinor, draft.defaultCurrency),
          },
          schedule: nextSchedule,
          linkedAccountIds: [primaryAssetId, secondaryAssetId],
          occurrenceIds: editingPlanId
            ? draft.plansById[editingPlanId]?.occurrenceIds ?? []
            : [],
        })
      })
      close()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save recurring item")
    }
  }

  return (
    <section className="flex flex-col gap-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-medium">
            {variant === "debts" ? "Debts" : "Recurring"}
          </h2>
          <p className="text-xs text-muted-foreground">
            {sheet.description} {sheet.summaryLabel}.
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          onClick={() =>
            startCreate(variant === "debts" ? "debt" : "salary")
          }
        >
          {variant === "debts" ? "Add debt" : "Add recurring"}
        </Button>
      </div>

      <NestedSheetTable
        rows={sheet.rows}
        emptyLabel={
          variant === "debts"
            ? "No repayment plans yet. Add a debt to track remaining balance."
            : "Nothing here yet. Add salary, a bill, or savings."
        }
        onOpenPlan={(planId) => {
          const plan = doc.plansById[planId]
          if (plan) startEdit(plan)
        }}
      />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingPlanId
                ? variant === "debts"
                  ? "Edit debt"
                  : "Edit recurring item"
                : variant === "debts"
                  ? "Add debt"
                  : "Add recurring item"}
            </DialogTitle>
            <DialogDescription>
              Choose the purpose first. Only relevant scheduling fields follow.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={save} className="flex flex-col gap-4">
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="recurring-task">What repeats?</FieldLabel>
                <select
                  id="recurring-task"
                  className={selectClassName}
                  value={task}
                  disabled={Boolean(editingPlanId)}
                  onChange={(event) => {
                    const nextTask = event.target.value as RecurringTask
                    setTask(nextTask)
                    setRequiresOriginalAmount(nextTask === "debt")
                  }}
                >
                  {variant === "debts" ? (
                    <option value="debt">Debt repayment</option>
                  ) : (
                    <>
                      <option value="salary">Salary</option>
                      <option value="subscription">Bill or subscription</option>
                      <option value="savings">Savings</option>
                    </>
                  )}
                </select>
              </Field>
              <Field>
                <FieldLabel htmlFor="recurring-name">Name</FieldLabel>
                <Input
                  id="recurring-name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder={
                    task === "salary"
                      ? "Company salary"
                      : task === "subscription"
                        ? "Streaming"
                        : task === "debt"
                          ? "Debt to Mom"
                          : "Emergency fund"
                  }
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="recurring-amount">
                  {task === "salary"
                    ? "Typical payday amount"
                    : task === "debt"
                      ? "Payment each time"
                      : "Amount each time"}{" "}
                  ({doc.defaultCurrency})
                </FieldLabel>
                <Input
                  id="recurring-amount"
                  inputMode="decimal"
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                  placeholder="1000.00"
                />
              </Field>
              {task === "debt" && requiresOriginalAmount ? (
                <Field>
                  <FieldLabel htmlFor="recurring-original-amount">
                    Original amount owed ({doc.defaultCurrency})
                  </FieldLabel>
                  <Input
                    id="recurring-original-amount"
                    inputMode="decimal"
                    value={originalAmount}
                    onChange={(event) =>
                      setOriginalAmount(event.target.value)
                    }
                    placeholder="12000.00"
                  />
                </Field>
              ) : null}
              <Field>
                <FieldLabel htmlFor="recurring-primary-account">
                  {task === "salary" ? "Deposited to" : "Paid from"}
                </FieldLabel>
                <select
                  id="recurring-primary-account"
                  className={selectClassName}
                  value={primaryAssetId}
                  onChange={(event) => setPrimaryAssetId(event.target.value)}
                >
                  <option value="">Choose bank or cash…</option>
                  {assets.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.name}
                    </option>
                  ))}
                </select>
              </Field>
              {task === "savings" ? (
                <Field>
                  <FieldLabel htmlFor="recurring-secondary-account">
                    Saved to
                  </FieldLabel>
                  <select
                    id="recurring-secondary-account"
                    className={selectClassName}
                    value={secondaryAssetId}
                    onChange={(event) =>
                      setSecondaryAssetId(event.target.value)
                    }
                  >
                    <option value="">Choose destination…</option>
                    {assets
                      .filter((account) => account.id !== primaryAssetId)
                      .map((account) => (
                        <option key={account.id} value={account.id}>
                          {account.name}
                        </option>
                      ))}
                  </select>
                </Field>
              ) : (
                <Field>
                  <FieldLabel htmlFor="recurring-counterparty">
                    {task === "salary"
                      ? "Income source"
                      : task === "debt"
                        ? "Who you owe"
                        : "Spending category"}
                  </FieldLabel>
                  <Input
                    id="recurring-counterparty"
                    value={counterpartyName}
                    onChange={(event) =>
                      setCounterpartyName(event.target.value)
                    }
                    placeholder={
                      task === "salary"
                        ? "Company"
                        : task === "debt"
                          ? "Mom"
                          : "Subscriptions"
                    }
                  />
                </Field>
              )}
              <div className="grid gap-3 sm:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="recurring-cadence">
                    When?
                  </FieldLabel>
                  <select
                    id="recurring-cadence"
                    className={selectClassName}
                    value={cadence}
                    onChange={(event) =>
                      setCadence(event.target.value as Cadence)
                    }
                  >
                    <option value="payday">Every payday</option>
                    <option value="monthly">Monthly at month-end</option>
                  </select>
                </Field>
                <Field>
                  <FieldLabel htmlFor="recurring-start">Starts</FieldLabel>
                  <Input
                    id="recurring-start"
                    type="date"
                    value={startDate}
                    onChange={(event) => setStartDate(event.target.value)}
                  />
                </Field>
              </div>
              {error ? <FieldError>{error}</FieldError> : null}
            </FieldGroup>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={close}>
                Cancel
              </Button>
              <Button type="submit" disabled={assets.length === 0}>
                {editingPlanId
                  ? "Save changes"
                  : variant === "debts"
                    ? "Add debt"
                    : "Add recurring item"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  )
}
