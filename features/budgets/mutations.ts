import * as Automerge from "@automerge/automerge/slim"

import { money, putMoney } from "./document"
import type {
  Account,
  AccountKind,
  AccountStatus,
  AmountOrFormula,
  BudgetDoc,
  Entry,
  EntryStatus,
  Money,
  Plan,
  PlanKind,
  PlanStatus,
  PlanTemplate,
  Posting,
  RuleAppliedStatus,
  RuleRunStatus,
  Schedule,
} from "./types"

function requireId(id: string, label: string): void {
  if (!id) throw new Error(`${label} id is required`)
}

const BUDGET_DOC_MAP_KEYS = [
  "accountsById",
  "entriesById",
  "plansById",
  "planTemplatesById",
  "rulesAppliedById",
  "ruleRunsById",
] as const

/**
 * Older Automerge docs may predate newer map fields (e.g. `planTemplatesById`).
 * Call inside `changeDoc` before reading/writing maps.
 */
export function ensureBudgetDocShape(draft: BudgetDoc): void {
  for (const key of BUDGET_DOC_MAP_KEYS) {
    const value = draft[key]
    if (value == null || typeof value !== "object") {
      draft[key] = {}
    }
  }
}

export function budgetDocNeedsShapeFix(doc: BudgetDoc): boolean {
  return BUDGET_DOC_MAP_KEYS.some((key) => {
    const value = doc[key]
    return value == null || typeof value !== "object"
  })
}

export type UpsertAccountInput = {
  id: string
  name: string
  kind: AccountKind
  /** Set to a parent id, or `null` to clear hierarchy. Omit to keep existing. */
  parentId?: string | null
  currency?: string | null
  status?: AccountStatus
}

export type UpsertEntryInput = {
  id: string
  description: string
  effectiveAt: string
  status: EntryStatus
  postings: Array<{
    accountId: string
    money: Money
    role?: string
  }>
  sourcePlanOccurrenceId?: string | null
  /** Set to a parent Entry id, or `null` to clear. Omit to keep existing. */
  parentId?: string | null
}

/**
 * Entry nesting: parent must be another Entry, not an Account, and must not
 * create a cycle. Used by payday grouping and nested sheet rows.
 */
export function assertEntryParent(
  draft: BudgetDoc,
  entryId: string,
  parentId: string,
): void {
  if (!parentId) throw new Error("parentId is required")
  if (parentId === entryId) {
    throw new Error("Entry cannot be its own parent")
  }
  if (draft.accountsById[parentId] && !draft.entriesById[parentId]) {
    throw new Error("Entry parentId must point to another Entry, not an Account")
  }
  const parent = draft.entriesById[parentId]
  if (!parent) {
    throw new Error(`Unknown parentId: ${parentId}`)
  }

  let cursor: string | undefined = parentId
  const seen = new Set<string>()
  while (cursor) {
    if (cursor === entryId) {
      throw new Error("Entry parentId would create a cycle")
    }
    if (seen.has(cursor)) {
      throw new Error("Entry parentId would create a cycle")
    }
    const node: Entry | undefined = draft.entriesById[cursor]
    if (!node) {
      throw new Error(`Unknown parentId: ${cursor}`)
    }
    seen.add(cursor)
    cursor = node.parentId
  }
}

export function cloneEntryPostings(
  postings: Posting[],
): Array<{ accountId: string; money: Money; role?: string }> {
  return postings.map((posting) => ({
    accountId: posting.accountId,
    money: {
      amountMinor: posting.money.amountMinor,
      currency: posting.money.currency,
    },
    ...(posting.role ? { role: posting.role } : {}),
  }))
}

/** Draft-safe Account write for use inside `changeDoc` / `Automerge.change`. */
export function applyUpsertAccount(
  draft: BudgetDoc,
  input: UpsertAccountInput,
): void {
  requireId(input.id, "Account")
  const existing = draft.accountsById[input.id]
  const next: Account = {
    id: input.id,
    name: input.name,
    kind: input.kind,
    status: input.status ?? existing?.status ?? "active",
  }

  if (input.parentId === null) {
    // cleared
  } else if (typeof input.parentId === "string" && input.parentId) {
    if (input.parentId === input.id) {
      throw new Error("Account cannot be its own parent")
    }
    if (!draft.accountsById[input.parentId]) {
      throw new Error(`Unknown parentId: ${input.parentId}`)
    }
    next.parentId = input.parentId
  } else if (existing?.parentId) {
    next.parentId = existing.parentId
  }

  if (input.currency === null) {
    // cleared
  } else if (typeof input.currency === "string" && input.currency) {
    next.currency = input.currency.toUpperCase()
  } else if (existing?.currency) {
    next.currency = existing.currency
  }

  draft.accountsById[input.id] = next
}

export function upsertAccount(
  doc: Automerge.Doc<BudgetDoc>,
  input: UpsertAccountInput,
): Automerge.Doc<BudgetDoc> {
  return Automerge.change(doc, (draft) => {
    applyUpsertAccount(draft, input)
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

/**
 * Simple transfer form helper: money leaves `fromAccountId` and enters `toAccountId`.
 * Generates the balancing pair so the UI can hide double-entry jargon.
 */
export function buildBalancingPostings(input: {
  fromAccountId: string
  toAccountId: string
  amountMinor: number
  currency: string
  fromRole?: string
  toRole?: string
}): Posting[] {
  if (!input.fromAccountId || !input.toAccountId) {
    throw new Error("fromAccountId and toAccountId are required")
  }
  if (input.fromAccountId === input.toAccountId) {
    throw new Error("from and to accounts must differ")
  }
  if (!Number.isInteger(input.amountMinor) || input.amountMinor <= 0) {
    throw new Error("amountMinor must be a positive integer")
  }

  const currency = input.currency.toUpperCase()
  return [
    {
      accountId: input.fromAccountId,
      money: money(-input.amountMinor, currency),
      ...(input.fromRole ? { role: input.fromRole } : {}),
    },
    {
      accountId: input.toAccountId,
      money: money(input.amountMinor, currency),
      ...(input.toRole ? { role: input.toRole } : {}),
    },
  ]
}

/** Draft-safe Entry write for use inside `changeDoc` / `Automerge.change`. */
export function applyUpsertEntry(
  draft: BudgetDoc,
  input: UpsertEntryInput,
): void {
  requireId(input.id, "Entry")
  const existing = draft.entriesById[input.id]

  if (input.status !== "void") {
    if (input.postings.length === 0) {
      if (input.status !== "proposed") {
        throw new Error(
          "Only proposed grouping Entries may have no postings",
        )
      }
    } else {
      assertPostingsBalanced(input.postings)
    }
  }

  for (const posting of input.postings) {
    if (!draft.accountsById[posting.accountId]) {
      throw new Error(`Unknown accountId in posting: ${posting.accountId}`)
    }
  }

  let parentId: string | undefined
  if (input.parentId === null) {
    parentId = undefined
  } else if (typeof input.parentId === "string" && input.parentId) {
    assertEntryParent(draft, input.id, input.parentId)
    parentId = input.parentId
  } else if (existing?.parentId) {
    parentId = existing.parentId
  }

  let sourcePlanOccurrenceId: string | undefined
  if (input.sourcePlanOccurrenceId === null) {
    sourcePlanOccurrenceId = undefined
  } else if (typeof input.sourcePlanOccurrenceId === "string") {
    sourcePlanOccurrenceId = input.sourcePlanOccurrenceId
  } else if (existing?.sourcePlanOccurrenceId) {
    sourcePlanOccurrenceId = existing.sourcePlanOccurrenceId
  }

  draft.entriesById[input.id] = {
    id: input.id,
    description: input.description,
    effectiveAt: input.effectiveAt,
    status: input.status,
    postings: [],
    ...(sourcePlanOccurrenceId
      ? { sourcePlanOccurrenceId }
      : {}),
    ...(parentId ? { parentId } : {}),
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
}

/**
 * Confirm a proposed Entry (NAN-19). Grouping nodes with no postings stay
 * proposed — they are nest parents, not money facts.
 */
export function applyConfirmEntry(draft: BudgetDoc, entryId: string): void {
  requireId(entryId, "Entry")
  const entry = draft.entriesById[entryId]
  if (!entry) throw new Error(`Unknown entryId: ${entryId}`)
  if (entry.status !== "proposed") {
    throw new Error("Only proposed Entries can be confirmed")
  }
  if (entry.postings.length === 0) {
    throw new Error("Grouping Entries cannot be posted")
  }
  applyUpsertEntry(draft, {
    id: entry.id,
    description: entry.description,
    effectiveAt: entry.effectiveAt,
    status: "posted",
    postings: cloneEntryPostings(entry.postings),
    ...(entry.sourcePlanOccurrenceId
      ? { sourcePlanOccurrenceId: entry.sourcePlanOccurrenceId }
      : {}),
    ...(entry.parentId ? { parentId: entry.parentId } : {}),
  })
}

export function confirmEntry(
  doc: Automerge.Doc<BudgetDoc>,
  entryId: string,
): Automerge.Doc<BudgetDoc> {
  return Automerge.change(doc, (draft) => {
    applyConfirmEntry(draft, entryId)
  })
}

export function upsertEntry(
  doc: Automerge.Doc<BudgetDoc>,
  input: UpsertEntryInput,
): Automerge.Doc<BudgetDoc> {
  return Automerge.change(doc, (draft) => {
    applyUpsertEntry(draft, input)
  })
}

/** Mark an Entry void. Posted history is never hard-deleted. */
export function applyVoidEntry(draft: BudgetDoc, entryId: string): void {
  requireId(entryId, "Entry")
  const entry = draft.entriesById[entryId]
  if (!entry) {
    throw new Error(`Unknown entryId: ${entryId}`)
  }
  entry.status = "void"
}

export function voidEntry(
  doc: Automerge.Doc<BudgetDoc>,
  entryId: string,
): Automerge.Doc<BudgetDoc> {
  return Automerge.change(doc, (draft) => {
    applyVoidEntry(draft, entryId)
  })
}

function writeAmountOrFormulaOnto(
  assign: (value: AmountOrFormula) => void,
  getMoneyTarget: () => { amountMinor: number; currency: string },
  value: AmountOrFormula,
): void {
  if (value.type === "fixed") {
    assign({
      type: "fixed",
      money: { amountMinor: 0, currency: value.money.currency },
    })
    putMoney(getMoneyTarget(), value.money)
    return
  }
  if (value.type === "percent") {
    assign({
      type: "percent",
      percentBps: new Automerge.Int(value.percentBps) as unknown as number,
      ...(value.ofAccountId ? { ofAccountId: value.ofAccountId } : {}),
    })
    return
  }
  if (value.type === "remainingBalance") {
    assign({
      type: "remainingBalance",
      ofAccountId: value.ofAccountId,
    })
    return
  }
  assign({
    type: "extension",
    key: value.key,
    ...(value.payload !== undefined ? { payload: value.payload } : {}),
  })
}

function writeAmountOrFormula(
  draftTarget: { amountOrFormula: AmountOrFormula },
  value: AmountOrFormula,
): void {
  writeAmountOrFormulaOnto(
    (next) => {
      draftTarget.amountOrFormula = next
    },
    () => (draftTarget.amountOrFormula as { money: Money }).money,
    value,
  )
}

function writeOptionalDefaultAmountOrFormula(
  draftTarget: { defaultAmountOrFormula?: AmountOrFormula },
  value: AmountOrFormula | undefined,
): void {
  if (!value) {
    delete draftTarget.defaultAmountOrFormula
    return
  }
  writeAmountOrFormulaOnto(
    (next) => {
      draftTarget.defaultAmountOrFormula = next
    },
    () =>
      (draftTarget.defaultAmountOrFormula as { money: Money }).money,
    value,
  )
}

function writeScheduleOnto(
  draftTarget: { schedule?: Schedule },
  schedule: Schedule | undefined | null,
): void {
  if (schedule === null || schedule === undefined) {
    delete draftTarget.schedule
    return
  }

  draftTarget.schedule = {
    timezone: schedule.timezone,
    anchors: [...schedule.anchors],
    adjustToPreviousWeekday: schedule.adjustToPreviousWeekday,
  }
  if (schedule.dayOfMonth !== undefined) {
    draftTarget.schedule.dayOfMonth = new Automerge.Int(
      schedule.dayOfMonth,
    ) as unknown as number
  }
  if (schedule.startAt) draftTarget.schedule.startAt = schedule.startAt
  if (schedule.endAt) draftTarget.schedule.endAt = schedule.endAt
  if (schedule.occurrenceCount !== undefined) {
    draftTarget.schedule.occurrenceCount = new Automerge.Int(
      schedule.occurrenceCount,
    ) as unknown as number
  }
}

function writeDefaultScheduleOnto(
  draftTarget: { defaultSchedule?: Schedule },
  schedule: Schedule | undefined | null,
): void {
  if (schedule === null || schedule === undefined) {
    delete draftTarget.defaultSchedule
    return
  }

  draftTarget.defaultSchedule = {
    timezone: schedule.timezone,
    anchors: [...schedule.anchors],
    adjustToPreviousWeekday: schedule.adjustToPreviousWeekday,
  }
  if (schedule.dayOfMonth !== undefined) {
    draftTarget.defaultSchedule.dayOfMonth = new Automerge.Int(
      schedule.dayOfMonth,
    ) as unknown as number
  }
  if (schedule.startAt) draftTarget.defaultSchedule.startAt = schedule.startAt
  if (schedule.endAt) draftTarget.defaultSchedule.endAt = schedule.endAt
  if (schedule.occurrenceCount !== undefined) {
    draftTarget.defaultSchedule.occurrenceCount = new Automerge.Int(
      schedule.occurrenceCount,
    ) as unknown as number
  }
}

function assertLinkedAccountsExist(
  draft: BudgetDoc,
  linkedAccountIds: string[],
): void {
  for (const accountId of linkedAccountIds) {
    if (!draft.accountsById[accountId]) {
      throw new Error(`Unknown linked accountId: ${accountId}`)
    }
  }
}

function assertPlanLinkedAccountKinds(
  draft: BudgetDoc,
  kind: PlanKind,
  linkedAccountIds: string[],
): void {
  const requiredKinds =
    kind === "income"
      ? (["income", "asset"] as const)
      : kind === "subscription"
        ? (["asset", "expense"] as const)
        : kind === "repayment"
          ? (["asset", "liability"] as const)
          : null
  if (!requiredKinds) return
  if (linkedAccountIds.length < 2) {
    throw new Error(
      `${kind} Plans require ${requiredKinds[0]} and ${requiredKinds[1]} accounts`,
    )
  }
  const [from, to] = linkedAccountIds.map((id) => draft.accountsById[id])
  if (from.kind !== requiredKinds[0] || to.kind !== requiredKinds[1]) {
    throw new Error(
      `${kind} Plans require ${requiredKinds[0]} → ${requiredKinds[1]} accounts`,
    )
  }
}

export type UpsertPlanInput = {
  id: string
  name: string
  kind: PlanKind
  /** Set to a template id, or `null` to clear. Omit to keep existing. */
  templateId?: string | null
  status?: PlanStatus
  amountOrFormula: AmountOrFormula
  /** Set a schedule, or `null` to clear. Omit to keep existing. */
  schedule?: Schedule | null
  linkedAccountIds?: string[]
  occurrenceIds?: string[]
}

/** Draft-safe Plan write for use inside `changeDoc` / `Automerge.change`. */
export function applyUpsertPlan(draft: BudgetDoc, input: UpsertPlanInput): void {
  ensureBudgetDocShape(draft)
  requireId(input.id, "Plan")
  const existing = draft.plansById[input.id]
  const linkedAccountIds = [
    ...(input.linkedAccountIds ?? existing?.linkedAccountIds ?? []),
  ]
  assertLinkedAccountsExist(draft, linkedAccountIds)
  assertPlanLinkedAccountKinds(draft, input.kind, linkedAccountIds)

  const next: Plan = {
    id: input.id,
    name: input.name,
    kind: input.kind,
    status: input.status ?? existing?.status ?? "active",
    amountOrFormula: { type: "extension", key: "_pending" },
    linkedAccountIds,
    occurrenceIds: [
      ...(input.occurrenceIds ?? existing?.occurrenceIds ?? []),
    ],
  }

  draft.plansById[input.id] = next
  const stored = draft.plansById[input.id]
  writeAmountOrFormula(stored, input.amountOrFormula)

  if (input.templateId === null) {
    delete stored.templateId
  } else if (typeof input.templateId === "string" && input.templateId) {
    if (!draft.planTemplatesById[input.templateId]) {
      throw new Error(`Unknown templateId: ${input.templateId}`)
    }
    stored.templateId = input.templateId
  } else if (existing?.templateId) {
    stored.templateId = existing.templateId
  }

  if (input.schedule === null) {
    writeScheduleOnto(stored, null)
  } else if (input.schedule) {
    writeScheduleOnto(stored, input.schedule)
  } else if (existing?.schedule) {
    writeScheduleOnto(stored, existing.schedule)
  }
}

export function upsertPlan(
  doc: Automerge.Doc<BudgetDoc>,
  input: UpsertPlanInput,
): Automerge.Doc<BudgetDoc> {
  return Automerge.change(doc, (draft) => {
    applyUpsertPlan(draft, input)
  })
}

/**
 * Cancel a Plan: stop future occurrences. Posted Entries and linked liability
 * Accounts are left untouched.
 */
export function applyCancelPlan(draft: BudgetDoc, planId: string): void {
  ensureBudgetDocShape(draft)
  requireId(planId, "Plan")
  const plan = draft.plansById[planId]
  if (!plan) throw new Error(`Unknown planId: ${planId}`)
  plan.status = "cancelled"
}

export function cancelPlan(
  doc: Automerge.Doc<BudgetDoc>,
  planId: string,
): Automerge.Doc<BudgetDoc> {
  return Automerge.change(doc, (draft) => {
    applyCancelPlan(draft, planId)
  })
}

export type UpsertPlanTemplateInput = {
  id: string
  name: string
  kind: PlanKind
  description?: string | null
  defaultAmountOrFormula?: AmountOrFormula | null
  defaultSchedule?: Schedule | null
  labels?: string[] | null
}

/** Draft-safe PlanTemplate write. */
export function applyUpsertPlanTemplate(
  draft: BudgetDoc,
  input: UpsertPlanTemplateInput,
): void {
  ensureBudgetDocShape(draft)
  requireId(input.id, "PlanTemplate")
  const existing = draft.planTemplatesById[input.id]

  const next: PlanTemplate = {
    id: input.id,
    name: input.name,
    kind: input.kind,
  }

  draft.planTemplatesById[input.id] = next
  const stored = draft.planTemplatesById[input.id]

  if (input.description === null) {
    delete stored.description
  } else if (typeof input.description === "string") {
    stored.description = input.description
  } else if (existing?.description) {
    stored.description = existing.description
  }

  if (input.labels === null) {
    delete stored.labels
  } else if (input.labels) {
    stored.labels = [...input.labels]
  } else if (existing?.labels) {
    stored.labels = [...existing.labels]
  }

  if (input.defaultAmountOrFormula === null) {
    writeOptionalDefaultAmountOrFormula(stored, undefined)
  } else if (input.defaultAmountOrFormula) {
    writeOptionalDefaultAmountOrFormula(stored, input.defaultAmountOrFormula)
  } else if (existing?.defaultAmountOrFormula) {
    writeOptionalDefaultAmountOrFormula(stored, existing.defaultAmountOrFormula)
  }

  if (input.defaultSchedule === null) {
    writeDefaultScheduleOnto(stored, null)
  } else if (input.defaultSchedule) {
    writeDefaultScheduleOnto(stored, input.defaultSchedule)
  } else if (existing?.defaultSchedule) {
    writeDefaultScheduleOnto(stored, existing.defaultSchedule)
  }
}

export function upsertPlanTemplate(
  doc: Automerge.Doc<BudgetDoc>,
  input: UpsertPlanTemplateInput,
): Automerge.Doc<BudgetDoc> {
  return Automerge.change(doc, (draft) => {
    applyUpsertPlanTemplate(draft, input)
  })
}

/** Remove a Plan template from the budget. Plans keep their copied fields. */
export function applyDeletePlanTemplate(
  draft: BudgetDoc,
  templateId: string,
): void {
  ensureBudgetDocShape(draft)
  requireId(templateId, "PlanTemplate")
  if (!draft.planTemplatesById[templateId]) {
    throw new Error(`Unknown templateId: ${templateId}`)
  }
  delete draft.planTemplatesById[templateId]
}

export function deletePlanTemplate(
  doc: Automerge.Doc<BudgetDoc>,
  templateId: string,
): Automerge.Doc<BudgetDoc> {
  return Automerge.change(doc, (draft) => {
    applyDeletePlanTemplate(draft, templateId)
  })
}

export type CreatePlanFromTemplateInput = {
  planId: string
  templateId: string
  /** Overrides template name when set */
  name?: string
  linkedAccountIds?: string[]
  amountOrFormula?: AmountOrFormula
  schedule?: Schedule
  status?: PlanStatus
}

/**
 * Seed a Plan from a budget PlanTemplate. Copies inspectable defaults;
 * `templateId` is retained for UI labels only (not executable code).
 */
export function applyCreatePlanFromTemplate(
  draft: BudgetDoc,
  input: CreatePlanFromTemplateInput,
): void {
  ensureBudgetDocShape(draft)
  requireId(input.planId, "Plan")
  requireId(input.templateId, "PlanTemplate")
  const template = draft.planTemplatesById[input.templateId]
  if (!template) throw new Error(`Unknown templateId: ${input.templateId}`)

  const amountOrFormula =
    input.amountOrFormula ??
    template.defaultAmountOrFormula ??
    ({ type: "extension", key: "unset" } satisfies AmountOrFormula)

  applyUpsertPlan(draft, {
    id: input.planId,
    name: input.name ?? template.name,
    kind: template.kind,
    templateId: template.id,
    status: input.status ?? "active",
    amountOrFormula,
    schedule: input.schedule ?? template.defaultSchedule ?? null,
    linkedAccountIds: input.linkedAccountIds ?? [],
    occurrenceIds: [],
  })
}

export function createPlanFromTemplate(
  doc: Automerge.Doc<BudgetDoc>,
  input: CreatePlanFromTemplateInput,
): Automerge.Doc<BudgetDoc> {
  return Automerge.change(doc, (draft) => {
    applyCreatePlanFromTemplate(draft, input)
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
