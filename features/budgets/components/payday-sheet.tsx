"use client"

import { useMemo, useState } from "react"
import type { ChangeFn } from "@automerge/automerge/slim"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

import { listPaydayPlans } from "../balances"
import { formatMinor, parseMajorToMinor } from "../money-format"
import { applyConfirmEntry } from "../mutations"
import {
  applyConfirmPaydayChildren,
  applyPreparePayday,
} from "../payday-prepare"
import { planSetupIssue } from "../scenario-commands"
import { expandSchedule } from "../schedule"
import { buildPaydaySheet, type NestedSheetRow } from "../sheets"
import type { BudgetDoc, Plan } from "../types"
import { NestedSheetTable } from "./nested-sheet"

type PaydaySheetProps = {
  doc: BudgetDoc
  changeDoc: (changeFn: ChangeFn<BudgetDoc>) => void
  onOpenRecurring?: () => void
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

export function PaydaySheet({
  doc,
  changeDoc,
  onOpenRecurring,
}: PaydaySheetProps) {
  const sheet = useMemo(() => buildPaydaySheet(doc), [doc])
  const plans = listPaydayPlans(doc)
  const validPlans = plans.filter((plan) => !planSetupIssue(doc, plan))
  const incompletePlans = plans.filter((plan) => planSetupIssue(doc, plan))
  const targetDate =
    sheet.rows[0]?.paydayDate ??
    validPlans
      .map(nextOccurrenceLabel)
      .filter(
        (date) =>
          date !== "No upcoming date" && date !== "Schedule unavailable",
      )
      .sort()[0]
  const salaryPlan = validPlans.find((plan) => plan.kind === "income")
  const expectedSalary =
    salaryPlan?.amountOrFormula.type === "fixed"
      ? salaryPlan.amountOrFormula.money.amountMinor
      : null
  const [actualSalary, setActualSalary] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const salaryInput =
    actualSalary ??
    (expectedSalary !== null ? String(expectedSalary / 100) : "")

  function parsedActualSalary(): number | undefined {
    if (!salaryPlan) return undefined
    return parseMajorToMinor(salaryInput)
  }

  function preparePayday(date = targetDate) {
    if (!date) return
    try {
      const actualMinor = parsedActualSalary()
      changeDoc((draft) => {
        applyPreparePayday(draft, {
          date,
          ...(actualMinor ? { actualSalaryMinor: actualMinor } : {}),
        })
      })
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not prepare payday")
    }
  }

  function confirmEntry(entryId: string) {
    changeDoc((draft) => {
      applyConfirmEntry(draft, entryId)
    })
  }

  function confirmGroup(row: NestedSheetRow) {
    if (!row.entryId && row.paydayDate) {
      preparePayday(row.paydayDate)
      return
    }
    if (!row.entryId) return
    changeDoc((draft) => {
      applyConfirmPaydayChildren(draft, row.entryId!)
    })
  }

  return (
    <section className="flex flex-col gap-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-medium">Payday</h2>
          <p className="text-xs text-muted-foreground">
            {sheet.description} {sheet.summaryLabel}.
          </p>
        </div>
        {targetDate ? (
          <Button type="button" size="sm" onClick={() => preparePayday()}>
            Prepare payday
          </Button>
        ) : (
          <Button type="button" size="sm" onClick={onOpenRecurring}>
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

      <NestedSheetTable
        rows={sheet.rows}
        emptyLabel="Add salary and commitments, then prepare a payday."
        onConfirmEntry={confirmEntry}
        onConfirmGroup={confirmGroup}
      />
      {error ? (
        <p className="text-xs text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  )
}
