/**
 * Domain types for one Budget Automerge document.
 * @see features/budgets/docs/data-model.md
 */

export const BUDGET_SCHEMA_VERSION = 1 as const

export type AccountKind = "asset" | "liability" | "income" | "expense"
export type AccountStatus = "active" | "archived"

export type EntryStatus = "proposed" | "posted" | "void"

/** Mechanical kernel kinds. User-facing recipes are Plan templates. */
export type PlanKind =
  | "income"
  | "allocation"
  | "subscription"
  | "repayment"
  | "other"

export type PlanStatus = "active" | "paused" | "cancelled" | "completed"

export type RuleAppliedStatus = "enabled" | "disabled"

export type RuleRunStatus = "succeeded" | "skipped" | "failed"

/** Integer minor units + ISO 4217 currency. Never floats. */
export type Money = {
  amountMinor: number
  currency: string
}

export type Posting = {
  accountId: string
  money: Money
  role?: string
}

export type Account = {
  id: string
  name: string
  kind: AccountKind
  parentId?: string
  currency?: string
  status: AccountStatus
}

export type Entry = {
  id: string
  description: string
  /** ISO-8601 financial date/time */
  effectiveAt: string
  status: EntryStatus
  postings: Posting[]
  sourcePlanOccurrenceId?: string
}

/**
 * Fixed money, percentage of a base, remaining balance of an account,
 * or an extension bag for later formula kinds.
 */
export type AmountOrFormula =
  | { type: "fixed"; money: Money }
  | { type: "percent"; percentBps: number; ofAccountId?: string }
  | { type: "remainingBalance"; ofAccountId: string }
  | { type: "extension"; key: string; payload?: string }

export type ScheduleAnchor = "dayOfMonth" | "endOfMonth"

export type Schedule = {
  timezone: string
  /** e.g. 15 for the 15th; ignored when anchor is endOfMonth */
  dayOfMonth?: number
  anchors: ScheduleAnchor[]
  adjustToPreviousWeekday: boolean
  startAt?: string
  endAt?: string
  occurrenceCount?: number
}

/**
 * User or catalog recipe that seeds a Plan.
 * “Installment (24 mo)” and “Debt to Mom” are templates over `repayment`, not separate kinds.
 */
export type PlanTemplate = {
  id: string
  name: string
  description?: string
  kind: PlanKind
  defaultAmountOrFormula?: AmountOrFormula
  defaultSchedule?: Schedule
  /** Hint labels for UI / Lenses; not a second ledger */
  labels?: string[]
}

export type Plan = {
  id: string
  name: string
  kind: PlanKind
  /** Optional template that seeded this Plan */
  templateId?: string
  status: PlanStatus
  amountOrFormula: AmountOrFormula
  schedule?: Schedule
  linkedAccountIds: string[]
  occurrenceIds: string[]
}

export type RuleApplied = {
  id: string
  ruleId: string
  status: RuleAppliedStatus
  pausedUntil?: string
  endsAt?: string
}

export type RuleRun = {
  id: string
  ruleId: string
  versionHash: string
  /** Deterministic occurrence key (e.g. scheduled date) */
  occurrenceKey: string
  status: RuleRunStatus
  generatedEntryIds: string[]
  ranAt: string
}

/**
 * Root shape of a Budget Automerge document.
 * Entity collections are maps keyed by stable IDs.
 */
export type BudgetDoc = {
  schemaVersion: typeof BUDGET_SCHEMA_VERSION
  id: string
  name: string
  timezone: string
  defaultCurrency: string
  accountsById: Record<string, Account>
  entriesById: Record<string, Entry>
  plansById: Record<string, Plan>
  /** User/household Plan recipes; catalog templates may also apply copies here */
  planTemplatesById: Record<string, PlanTemplate>
  rulesAppliedById: Record<string, RuleApplied>
  ruleRunsById: Record<string, RuleRun>
}
