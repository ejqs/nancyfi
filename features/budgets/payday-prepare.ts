/**
 * Payday grouping: nest proposed Plan occurrences under a parent Entry.
 * Confirm-to-post (NAN-19) posts children, not the empty grouping parent.
 */

import * as Automerge from "@automerge/automerge/slim"

import {
  applyConfirmEntry,
  applyUpsertEntry,
  cloneEntryPostings,
  ensureBudgetDocShape,
} from "./mutations"
import { applyProposePlanOccurrences } from "./plan-propose"
import { listPaydayPlans } from "./balances"
import { planSetupIssue } from "./scenario-commands"
import { expandSchedule } from "./schedule"
import {
  paydayParentEntryId,
  listChildEntries,
} from "./entry-tree"
import type { BudgetDoc, Plan } from "./types"

export type PreparePaydayInput = {
  date: string
  /** Actual salary for this occurrence; percent allocations use this base. */
  actualSalaryMinor?: number
}

export type PreparePaydayResult = {
  parentId: string
  createdEntryIds: string[]
}

function duePlansOnDate(doc: BudgetDoc, date: string): Plan[] {
  return listPaydayPlans(doc).filter((plan) => {
    if (planSetupIssue(doc, plan) || !plan.schedule) return false
    try {
      return expandSchedule(plan.schedule, { from: date, to: date }).length > 0
    } catch {
      return false
    }
  })
}

export function applyPreparePayday(
  draft: BudgetDoc,
  input: PreparePaydayInput,
): PreparePaydayResult {
  ensureBudgetDocShape(draft)
  const parentId = paydayParentEntryId(input.date)
  const existing = draft.entriesById[parentId]
  applyUpsertEntry(draft, {
    id: parentId,
    description: `Payday ${input.date}`,
    effectiveAt: `${input.date}T12:00:00.000Z`,
    status: existing?.status === "void" ? "proposed" : (existing?.status ?? "proposed"),
    postings: existing?.postings.length
      ? cloneEntryPostings(existing.postings)
      : [],
  })

  const salaryPlan = duePlansOnDate(draft, input.date).find(
    (plan) => plan.kind === "income",
  )
  const createdEntryIds: string[] = []

  for (const plan of duePlansOnDate(draft, input.date)) {
    const result = applyProposePlanOccurrences(draft, {
      planId: plan.id,
      range: { from: input.date, to: input.date },
      parentId,
      ...(plan.id === salaryPlan?.id && input.actualSalaryMinor
        ? { amountMinorOverride: input.actualSalaryMinor }
        : {}),
      ...(plan.amountOrFormula.type === "percent" && input.actualSalaryMinor
        ? { baseAmountMinor: input.actualSalaryMinor }
        : {}),
    })
    createdEntryIds.push(...result.createdEntryIds)
  }

  for (const entry of Object.values(draft.entriesById ?? {})) {
    if (entry.id === parentId) continue
    if (entry.status === "void") continue
    if (entry.effectiveAt.slice(0, 10) !== input.date) continue
    const fromDuePlan = duePlansOnDate(draft, input.date).some((plan) =>
      entry.sourcePlanOccurrenceId?.startsWith(`${plan.id}:`),
    )
    if (!fromDuePlan) continue
    if (entry.parentId === parentId) continue
    applyUpsertEntry(draft, {
      id: entry.id,
      description: entry.description,
      effectiveAt: entry.effectiveAt,
      status: entry.status,
      postings: cloneEntryPostings(entry.postings),
      ...(entry.sourcePlanOccurrenceId
        ? { sourcePlanOccurrenceId: entry.sourcePlanOccurrenceId }
        : {}),
      parentId,
    })
  }

  return { parentId, createdEntryIds }
}

/** Post proposed children under a payday parent. Parent stays proposed. */
export function applyConfirmPaydayChildren(
  draft: BudgetDoc,
  parentId: string,
): string[] {
  ensureBudgetDocShape(draft)
  const postedIds: string[] = []
  for (const child of listChildEntries(draft, parentId)) {
    if (child.status !== "proposed") continue
    if (child.postings.length === 0) continue
    applyConfirmEntry(draft, child.id)
    postedIds.push(child.id)
  }
  return postedIds
}

export function preparePayday(
  doc: Automerge.Doc<BudgetDoc>,
  input: PreparePaydayInput,
): { doc: Automerge.Doc<BudgetDoc>; result: PreparePaydayResult } {
  let result: PreparePaydayResult = { parentId: "", createdEntryIds: [] }
  const next = Automerge.change(doc, (draft) => {
    result = applyPreparePayday(draft, input)
  })
  return { doc: next, result }
}

export function confirmPaydayChildren(
  doc: Automerge.Doc<BudgetDoc>,
  parentId: string,
): { doc: Automerge.Doc<BudgetDoc>; postedIds: string[] } {
  let postedIds: string[] = []
  const next = Automerge.change(doc, (draft) => {
    postedIds = applyConfirmPaydayChildren(draft, parentId)
  })
  return { doc: next, postedIds }
}
