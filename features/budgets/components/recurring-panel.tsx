"use client"

import { useState } from "react"
import type { ChangeFn } from "@automerge/automerge/slim"
import { MoreHorizontal } from "lucide-react"

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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"

import { listDebtDetails } from "../balances"
import { money } from "../document"
import { formatMinor, parseMajorToMinor } from "../money-format"
import { applyCancelPlan, applyUpsertPlan } from "../mutations"
import {
  applyCreateDebtRepayment,
  applyCreateSalary,
  applyCreateSubscription,
  planSetupIssue,
} from "../scenario-commands"
import { createPaydaySchedule, expandSchedule } from "../schedule"
import type { BudgetDoc, Plan, Schedule } from "../types"
import {
  ListRow,
  RowActions,
  RowMeta,
  RowTitle,
  StatusDot,
} from "./list-row"

type RecurringTask = "salary" | "subscription" | "debt" | "savings"
type Cadence = "payday" | "monthly"

type RecurringPanelProps = {
  doc: BudgetDoc
  changeDoc: (changeFn: ChangeFn<BudgetDoc>) => void
}

const selectClassName =
  "h-7 w-full rounded-md border border-input bg-input/20 px-2 text-xs outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"

const GROUPS: Array<{
  title: string
  tasks: RecurringTask[]
  kinds: Plan["kind"][]
}> = [
  { title: "Income", tasks: ["salary"], kinds: ["income"] },
  {
    title: "Bills & subscriptions",
    tasks: ["subscription"],
    kinds: ["subscription"],
  },
  { title: "Savings", tasks: ["savings"], kinds: ["allocation"] },
  { title: "Debt", tasks: ["debt"], kinds: ["repayment"] },
]

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

function nextDate(plan: Plan): string {
  if (!plan.schedule) return "No schedule"
  try {
    const from = localDate()
    const end = new Date()
    end.setDate(end.getDate() + 65)
    const to = `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, "0")}-${String(end.getDate()).padStart(2, "0")}`
    return expandSchedule(plan.schedule, { from, to })[0]?.date ?? "No upcoming date"
  } catch {
    return "Schedule unavailable"
  }
}

function amountLabel(plan: Plan): string {
  if (plan.amountOrFormula.type === "fixed") {
    return formatMinor(
      plan.amountOrFormula.money.amountMinor,
      plan.amountOrFormula.money.currency,
    )
  }
  if (plan.amountOrFormula.type === "percent") {
    return `${plan.amountOrFormula.percentBps / 100}%`
  }
  return "Calculated"
}

function projectedFinish(plan: Plan, remainingMinor: number): string {
  if (remainingMinor <= 0) return "Paid off"
  if (
    !plan.schedule ||
    plan.amountOrFormula.type !== "fixed" ||
    plan.amountOrFormula.money.amountMinor <= 0
  ) {
    return "Finish date unavailable"
  }
  const payments = Math.ceil(
    remainingMinor / plan.amountOrFormula.money.amountMinor,
  )
  const from = localDate()
  const end = new Date()
  end.setFullYear(end.getFullYear() + 10)
  const to = `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, "0")}-${String(end.getDate()).padStart(2, "0")}`
  try {
    const occurrences = expandSchedule(plan.schedule, { from, to })
    return occurrences[payments - 1]?.date ?? `${payments} payments left`
  } catch {
    return `${payments} payments left`
  }
}

function taskForPlan(plan: Plan): RecurringTask {
  if (plan.kind === "income") return "salary"
  if (plan.kind === "subscription") return "subscription"
  if (plan.kind === "repayment") return "debt"
  return "savings"
}

export function RecurringPanel({ doc, changeDoc }: RecurringPanelProps) {
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

  const plans = Object.values(doc.plansById ?? {}).sort((a, b) =>
    a.name.localeCompare(b.name),
  )
  const debtByPlanId = new Map(
    listDebtDetails(doc).map((detail) => [detail.plan.id, detail] as const),
  )
  const assets = Object.values(doc.accountsById ?? {})
    .filter((account) => account.status === "active" && account.kind === "asset")
    .sort((a, b) => a.name.localeCompare(b.name))

  function reset() {
    setEditingPlanId(null)
    setTask("salary")
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

  function setStatus(plan: Plan, status: "active" | "paused") {
    changeDoc((draft) => {
      applyUpsertPlan(draft, {
        id: plan.id,
        name: plan.name,
        kind: plan.kind,
        status,
        amountOrFormula: plan.amountOrFormula,
        schedule: plan.schedule ?? null,
        linkedAccountIds: [...plan.linkedAccountIds],
        occurrenceIds: [...plan.occurrenceIds],
      })
    })
  }

  return (
    <section className="flex flex-col gap-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-medium">Recurring</h2>
          <p className="text-xs text-muted-foreground">
            Salary, bills, savings, and debt—organized by purpose.
          </p>
        </div>
        <Button type="button" size="sm" onClick={() => startCreate()}>
          Add recurring
        </Button>
      </div>

      {GROUPS.map((group) => {
        const rows = plans.filter((plan) => group.kinds.includes(plan.kind))
        return (
          <section key={group.title} className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-medium text-muted-foreground">
                {group.title}
              </h3>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => startCreate(group.tasks[0])}
              >
                Add
              </Button>
            </div>
            {rows.length === 0 ? (
              <p className="text-xs text-muted-foreground">Nothing here yet.</p>
            ) : (
              <div className="rounded-md border border-border/80">
                {rows.map((plan) => {
                  const setupIssue = planSetupIssue(doc, plan)
                  const debt = debtByPlanId.get(plan.id)
                  return (
                    <ListRow key={plan.id}>
                      <StatusDot
                        tone={
                          setupIssue || plan.status !== "active"
                            ? "muted"
                            : "active"
                        }
                        label={setupIssue ? "incomplete" : plan.status}
                      />
                      <RowTitle>
                        {plan.name}
                        {setupIssue ? (
                          <span className="ml-2 text-xs font-normal text-muted-foreground">
                            Finish setup
                          </span>
                        ) : null}
                      </RowTitle>
                      <RowMeta>
                        {setupIssue
                          ? setupIssue
                          : debt
                            ? `original ${formatMinor(debt.originalMinor, debt.currency)} · paid ${formatMinor(debt.paidMinor, debt.currency)} · remaining ${formatMinor(debt.remainingMinor, debt.currency)} · next ${nextDate(plan)} · finish ${projectedFinish(plan, debt.remainingMinor)}`
                            : `${amountLabel(plan)} · next ${nextDate(plan)}`}
                        {plan.kind === "repayment" && !debt && !setupIssue
                          ? " · Add the original amount to calculate debt"
                          : ""}
                      </RowMeta>
                      <RowActions>
                        {setupIssue ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => startEdit(plan)}
                          >
                            Finish setup
                          </Button>
                        ) : (
                          <DropdownMenu>
                            <DropdownMenuTrigger
                              render={
                                <Button
                                  type="button"
                                  size="icon-sm"
                                  variant="ghost"
                                  aria-label={`More actions for ${plan.name}`}
                                />
                              }
                            >
                              <MoreHorizontal />
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuGroup>
                                <DropdownMenuItem onClick={() => startEdit(plan)}>
                                  Edit
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() =>
                                    setStatus(
                                      plan,
                                      plan.status === "paused"
                                        ? "active"
                                        : "paused",
                                    )
                                  }
                                >
                                  {plan.status === "paused" ? "Resume" : "Pause"}
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  variant="destructive"
                                  onClick={() => {
                                    if (
                                      window.confirm(
                                        "Cancel this recurring item? Past transactions and debt remain.",
                                      )
                                    ) {
                                      changeDoc((draft) => {
                                        applyCancelPlan(draft, plan.id)
                                      })
                                    }
                                  }}
                                >
                                  Cancel recurring item
                                </DropdownMenuItem>
                              </DropdownMenuGroup>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </RowActions>
                    </ListRow>
                  )
                })}
              </div>
            )}
          </section>
        )
      })}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingPlanId ? "Edit recurring item" : "Add recurring item"}
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
                  <option value="salary">Salary</option>
                  <option value="subscription">Bill or subscription</option>
                  <option value="debt">Debt repayment</option>
                  <option value="savings">Savings</option>
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
                {editingPlanId ? "Save changes" : "Add recurring item"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  )
}
