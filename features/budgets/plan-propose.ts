/**
 * Generate proposed Entries from active Plans.
 * Does not rewrite Plan typical amounts or posted history.
 *
 * @see features/budgets/docs/data-model.md
 * @see docs/scenarios/payday-subscriptions-and-debt.md
 */

import type {
  AmountOrFormula,
  BudgetDoc,
  Plan,
  PlanKind,
  Posting,
} from "./types"
import { applyUpsertEntry, buildBalancingPostings, ensureBudgetDocShape } from "./mutations"
import { expandSchedule, type CalendarDate } from "./schedule"

export type ProposePlanOccurrencesInput = {
  planId: string
  /** Inclusive calendar range (YYYY-MM-DD) for schedule expansion */
  range: { from: CalendarDate; to: CalendarDate }
  /**
   * Base for percent formulas (e.g. actual salary Entry amount).
   * Required when `amountOrFormula.type === "percent"`.
   */
  baseAmountMinor?: number
  /** Override resolved amount (does not mutate the Plan). */
  amountMinorOverride?: number
  /** Deterministic Entry ids in tests: `(sourcePlanOccurrenceId) => entryId` */
  entryIdForOccurrence?: (sourcePlanOccurrenceId: string) => string
  /** Nest generated Entries under a grouping Entry (payday parent). */
  parentId?: string
}

export type ProposePlanOccurrencesResult = {
  createdEntryIds: string[]
  skippedOccurrenceIds: string[]
}

/** Deterministic Plan occurrence key (idempotent across devices). */
export function buildPlanOccurrenceId(
  planId: string,
  scheduleOccurrenceId: string,
): string {
  return `${planId}:${scheduleOccurrenceId}`
}

/**
 * Signed balance of an Account from posted Entries (void ignored).
 * Debits positive / credits negative per NAN-19.
 */
export function accountPostedBalanceMinor(
  doc: BudgetDoc,
  accountId: string,
  currency: string,
): number {
  const cur = currency.toUpperCase()
  let sum = 0
  for (const entry of Object.values(doc.entriesById)) {
    if (entry.status !== "posted") continue
    for (const posting of entry.postings) {
      if (posting.accountId !== accountId) continue
      if (posting.money.currency.toUpperCase() !== cur) continue
      sum += posting.money.amountMinor
    }
  }
  return sum
}

export function resolvePlanAmountMinor(
  doc: BudgetDoc,
  plan: Plan,
  options?: {
    baseAmountMinor?: number
    amountMinorOverride?: number
    currency?: string
  },
): { amountMinor: number; currency: string } {
  if (options?.amountMinorOverride !== undefined) {
    if (
      !Number.isInteger(options.amountMinorOverride) ||
      options.amountMinorOverride <= 0
    ) {
      throw new Error("amountMinorOverride must be a positive integer")
    }
    return {
      amountMinor: options.amountMinorOverride,
      currency: (options.currency ?? doc.defaultCurrency).toUpperCase(),
    }
  }

  return resolveAmountOrFormula(doc, plan.amountOrFormula, {
    baseAmountMinor: options?.baseAmountMinor,
    currency: options?.currency ?? doc.defaultCurrency,
  })
}

function resolveAmountOrFormula(
  doc: BudgetDoc,
  formula: AmountOrFormula,
  options: { baseAmountMinor?: number; currency: string },
): { amountMinor: number; currency: string } {
  if (formula.type === "fixed") {
    if (formula.money.amountMinor <= 0) {
      throw new Error("Plan fixed amount must be positive")
    }
    return {
      amountMinor: formula.money.amountMinor,
      currency: formula.money.currency.toUpperCase(),
    }
  }
  if (formula.type === "percent") {
    if (options.baseAmountMinor === undefined) {
      throw new Error(
        "percent Plans require baseAmountMinor (e.g. actual salary Entry)",
      )
    }
    if (
      !Number.isInteger(options.baseAmountMinor) ||
      options.baseAmountMinor <= 0
    ) {
      throw new Error("baseAmountMinor must be a positive integer")
    }
    const amountMinor = Math.trunc(
      (options.baseAmountMinor * formula.percentBps) / 10_000,
    )
    if (amountMinor <= 0) {
      throw new Error("Resolved percent amount must be positive")
    }
    return {
      amountMinor,
      currency: options.currency.toUpperCase(),
    }
  }
  if (formula.type === "remainingBalance") {
    const balance = accountPostedBalanceMinor(
      doc,
      formula.ofAccountId,
      options.currency,
    )
    // Liability accounts typically hold credit balances (negative). Take abs.
    const amountMinor = Math.abs(balance)
    if (amountMinor <= 0) {
      throw new Error("remainingBalance resolved to zero")
    }
    return { amountMinor, currency: options.currency.toUpperCase() }
  }
  throw new Error(
    `Cannot resolve amount for formula type "${formula.type}" (${"key" in formula ? formula.key : ""})`,
  )
}

/**
 * Posting roles and from→to direction by kernel kind.
 * `linkedAccountIds[0]` = from, `[1]` = to (simple transfer form).
 */
export function postingRolesForKind(kind: PlanKind): {
  fromRole: string
  toRole: string
} {
  switch (kind) {
    case "income":
      return { fromRole: "income", toRole: "deposit" }
    case "allocation":
      return { fromRole: "source", toRole: "allocation" }
    case "subscription":
      return { fromRole: "payment", toRole: "expense" }
    case "repayment":
      return { fromRole: "payment", toRole: "principal" }
    case "other":
      return { fromRole: "payment", toRole: "transfer" }
  }
}

function buildPostingsForPlan(
  plan: Plan,
  amountMinor: number,
  currency: string,
): Posting[] {
  if (plan.linkedAccountIds.length < 2) {
    throw new Error(
      "Plan needs at least two linkedAccountIds (from, to) to propose Entries",
    )
  }
  const [fromAccountId, toAccountId] = plan.linkedAccountIds
  const roles = postingRolesForKind(plan.kind)
  return buildBalancingPostings({
    fromAccountId,
    toAccountId,
    amountMinor,
    currency,
    fromRole: roles.fromRole,
    toRole: roles.toRole,
  })
}

/**
 * Expand the Plan schedule and create **proposed** Entries for new occurrences.
 * Skips cancelled/paused Plans and already-recorded occurrenceIds.
 * Never mutates the Plan's typical `amountOrFormula` (salary variance lives on Entry).
 */
export function applyProposePlanOccurrences(
  draft: BudgetDoc,
  input: ProposePlanOccurrencesInput,
): ProposePlanOccurrencesResult {
  ensureBudgetDocShape(draft)
  const plan = draft.plansById[input.planId]
  if (!plan) throw new Error(`Unknown planId: ${input.planId}`)
  // Only active Plans generate proposals. Cancelled/paused/completed stop future ones.
  if (plan.status !== "active") {
    return { createdEntryIds: [], skippedOccurrenceIds: [] }
  }
  if (!plan.schedule) {
    throw new Error(`Plan ${plan.id} has no schedule`)
  }

  const { amountMinor, currency } = resolvePlanAmountMinor(draft, plan, {
    baseAmountMinor: input.baseAmountMinor,
    amountMinorOverride: input.amountMinorOverride,
  })

  const occurrences = expandSchedule(plan.schedule, input.range)
  const known = new Set(plan.occurrenceIds)
  const createdEntryIds: string[] = []
  const skippedOccurrenceIds: string[] = []

  for (const occ of occurrences) {
    const sourcePlanOccurrenceId = buildPlanOccurrenceId(
      plan.id,
      occ.occurrenceId,
    )
    if (known.has(sourcePlanOccurrenceId)) {
      skippedOccurrenceIds.push(sourcePlanOccurrenceId)
      continue
    }

    const entryId =
      input.entryIdForOccurrence?.(sourcePlanOccurrenceId) ??
      `${sourcePlanOccurrenceId}:entry`

    const postings = buildPostingsForPlan(plan, amountMinor, currency)
    const effectiveAt = `${occ.date}T12:00:00.000Z`

    applyUpsertEntry(draft, {
      id: entryId,
      description: `${plan.name} (${occ.date})`,
      effectiveAt,
      status: "proposed",
      postings,
      sourcePlanOccurrenceId,
      ...(input.parentId ? { parentId: input.parentId } : {}),
    })

    plan.occurrenceIds.push(sourcePlanOccurrenceId)
    known.add(sourcePlanOccurrenceId)
    createdEntryIds.push(entryId)
  }

  return { createdEntryIds, skippedOccurrenceIds }
}
