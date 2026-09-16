import * as Automerge from "@automerge/automerge/slim"

import { putMoney } from "./document"
import type {
  Account,
  AccountKind,
  AccountStatus,
  AmountOrFormula,
  BudgetDoc,
  EntryStatus,
  Money,
  PlanKind,
  PlanStatus,
  Posting,
  RuleAppliedStatus,
  RuleRunStatus,
  Schedule,
} from "./types"

function requireId(id: string, label: string): void {
  if (!id) throw new Error(`${label} id is required`)
}

export function upsertAccount(
  doc: Automerge.Doc<BudgetDoc>,
  input: {
    id: string
    name: string
    kind: AccountKind
    parentId?: string
    currency?: string
    status?: AccountStatus
  },
): Automerge.Doc<BudgetDoc> {
  requireId(input.id, "Account")
  return Automerge.change(doc, (draft) => {
    const existing = draft.accountsById[input.id]
    const next: Account = {
      id: input.id,
      name: input.name,
      kind: input.kind,
      status: input.status ?? existing?.status ?? "active",
    }
    if (input.parentId !== undefined) next.parentId = input.parentId
    else if (existing?.parentId) next.parentId = existing.parentId
    if (input.currency !== undefined) next.currency = input.currency
    else if (existing?.currency) next.currency = existing.currency
    draft.accountsById[input.id] = next
  })
}

/**
 * Sum of posting amountMinor must be 0 per currency for posted/proposed entries.
 * Void entries are not re-validated here.
 */
export function assertPostingsBalanced(postings: Posting[]): void {
  if (postings.length < 2) {
    throw new Error("An Entry needs at least two postings")
  }
  const byCurrency = new Map<string, number>()
  for (const posting of postings) {
    if (!Number.isInteger(posting.money.amountMinor)) {
      throw new Error("Posting money.amountMinor must be an integer")
    }
    const currency = posting.money.currency.toUpperCase()
    byCurrency.set(
      currency,
      (byCurrency.get(currency) ?? 0) + posting.money.amountMinor,
    )
  }
  for (const [currency, sum] of byCurrency) {
    if (sum !== 0) {
      throw new Error(
        `Postings for ${currency} do not balance (sum=${sum}); expected 0`,
      )
    }
  }
}

export function upsertEntry(
  doc: Automerge.Doc<BudgetDoc>,
  input: {
    id: string
    description: string
    effectiveAt: string
    status: EntryStatus
    postings: Array<{
      accountId: string
      money: Money
      role?: string
    }>
    sourcePlanOccurrenceId?: string
  },
): Automerge.Doc<BudgetDoc> {
  requireId(input.id, "Entry")
  if (input.status !== "void") {
    assertPostingsBalanced(input.postings)
  }

  return Automerge.change(doc, (draft) => {
    for (const posting of input.postings) {
      if (!draft.accountsById[posting.accountId]) {
        throw new Error(`Unknown accountId in posting: ${posting.accountId}`)
      }
    }

    draft.entriesById[input.id] = {
      id: input.id,
      description: input.description,
      effectiveAt: input.effectiveAt,
      status: input.status,
      postings: [],
      ...(input.sourcePlanOccurrenceId
        ? { sourcePlanOccurrenceId: input.sourcePlanOccurrenceId }
        : {}),
    }

    const stored = draft.entriesById[input.id]
    for (const posting of input.postings) {
      stored.postings.push({
        accountId: posting.accountId,
        money: { amountMinor: 0, currency: posting.money.currency },
        ...(posting.role ? { role: posting.role } : {}),
      })
      putMoney(
        stored.postings[stored.postings.length - 1].money,
        posting.money,
      )
    }
  })
}

function writeAmountOrFormula(
  draftPlan: { amountOrFormula: AmountOrFormula },
  value: AmountOrFormula,
): void {
  if (value.type === "fixed") {
    draftPlan.amountOrFormula = {
      type: "fixed",
      money: { amountMinor: 0, currency: value.money.currency },
    }
    putMoney(
      (draftPlan.amountOrFormula as { money: Money }).money,
      value.money,
    )
    return
  }
  if (value.type === "percent") {
    draftPlan.amountOrFormula = {
      type: "percent",
      percentBps: new Automerge.Int(value.percentBps) as unknown as number,
      ...(value.ofAccountId ? { ofAccountId: value.ofAccountId } : {}),
    }
    return
  }
  if (value.type === "remainingBalance") {
    draftPlan.amountOrFormula = {
      type: "remainingBalance",
      ofAccountId: value.ofAccountId,
    }
    return
  }
  draftPlan.amountOrFormula = {
    type: "extension",
    key: value.key,
    ...(value.payload !== undefined ? { payload: value.payload } : {}),
  }
}

export function upsertPlan(
  doc: Automerge.Doc<BudgetDoc>,
  input: {
    id: string
    name: string
    kind: PlanKind
    status?: PlanStatus
    amountOrFormula: AmountOrFormula
    schedule?: Schedule
    linkedAccountIds?: string[]
    occurrenceIds?: string[]
  },
): Automerge.Doc<BudgetDoc> {
  requireId(input.id, "Plan")
  return Automerge.change(doc, (draft) => {
    const existing = draft.plansById[input.id]
    draft.plansById[input.id] = {
      id: input.id,
      name: input.name,
      kind: input.kind,
      status: input.status ?? existing?.status ?? "active",
      amountOrFormula: { type: "extension", key: "_pending" },
      linkedAccountIds: [
        ...(input.linkedAccountIds ?? existing?.linkedAccountIds ?? []),
      ],
      occurrenceIds: [
        ...(input.occurrenceIds ?? existing?.occurrenceIds ?? []),
      ],
    }

    const stored = draft.plansById[input.id]
    writeAmountOrFormula(stored, input.amountOrFormula)

    if (input.schedule) {
      stored.schedule = {
        timezone: input.schedule.timezone,
        anchors: [...input.schedule.anchors],
        adjustToPreviousWeekday: input.schedule.adjustToPreviousWeekday,
      }
      if (input.schedule.dayOfMonth !== undefined) {
        stored.schedule.dayOfMonth = new Automerge.Int(
          input.schedule.dayOfMonth,
        ) as unknown as number
      }
      if (input.schedule.startAt) stored.schedule.startAt = input.schedule.startAt
      if (input.schedule.endAt) stored.schedule.endAt = input.schedule.endAt
      if (input.schedule.occurrenceCount !== undefined) {
        stored.schedule.occurrenceCount = new Automerge.Int(
          input.schedule.occurrenceCount,
        ) as unknown as number
      }
    }
  })
}

export function upsertRuleApplied(
  doc: Automerge.Doc<BudgetDoc>,
  input: {
    id: string
    ruleId: string
    status?: RuleAppliedStatus
    pausedUntil?: string
    endsAt?: string
  },
): Automerge.Doc<BudgetDoc> {
  requireId(input.id, "RuleApplied")
  return Automerge.change(doc, (draft) => {
    const existing = draft.rulesAppliedById[input.id]
    draft.rulesAppliedById[input.id] = {
      id: input.id,
      ruleId: input.ruleId,
      status: input.status ?? existing?.status ?? "enabled",
      ...(input.pausedUntil !== undefined
        ? { pausedUntil: input.pausedUntil }
        : existing?.pausedUntil
          ? { pausedUntil: existing.pausedUntil }
          : {}),
      ...(input.endsAt !== undefined
        ? { endsAt: input.endsAt }
        : existing?.endsAt
          ? { endsAt: existing.endsAt }
          : {}),
    }
  })
}

export function upsertRuleRun(
  doc: Automerge.Doc<BudgetDoc>,
  input: {
    id: string
    ruleId: string
    versionHash: string
    occurrenceKey: string
    status: RuleRunStatus
    generatedEntryIds?: string[]
    ranAt: string
  },
): Automerge.Doc<BudgetDoc> {
  requireId(input.id, "RuleRun")
  return Automerge.change(doc, (draft) => {
    draft.ruleRunsById[input.id] = {
      id: input.id,
      ruleId: input.ruleId,
      versionHash: input.versionHash,
      occurrenceKey: input.occurrenceKey,
      status: input.status,
      generatedEntryIds: [...(input.generatedEntryIds ?? [])],
      ranAt: input.ranAt,
    }
  })
}
