import { money } from "./document"
import {
  applyUpsertAccount,
  applyUpsertEntry,
  applyUpsertPlan,
  buildBalancingPostings,
  ensureBudgetDocShape,
} from "./mutations"
import { accountPostedBalanceMinor } from "./plan-propose"
import { createPaydaySchedule } from "./schedule"
import type {
  Account,
  AccountKind,
  BudgetDoc,
  Plan,
  Schedule,
} from "./types"

/** Default P&L clearing account for balance resets when no offset is chosen. */
export const BALANCE_ADJUSTMENTS_ACCOUNT_NAME = "Balance adjustments"

type NamedAccountInput = {
  accountId?: string
  name?: string
}

type TaskResult = {
  accountIds: string[]
  entryIds: string[]
  planIds: string[]
}

function taskId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`
}

function requirePositiveMinor(amountMinor: number, label: string): void {
  if (!Number.isInteger(amountMinor) || amountMinor <= 0) {
    throw new Error(`${label} must be a positive integer in minor units`)
  }
}

function requireActiveAccount(
  doc: BudgetDoc,
  accountId: string,
  allowedKinds: AccountKind[],
  label: string,
): Account {
  const account = doc.accountsById[accountId]
  if (!account || account.status !== "active") {
    throw new Error(`${label} must be an active account`)
  }
  if (!allowedKinds.includes(account.kind)) {
    throw new Error(
      `${label} must be ${allowedKinds.join(" or ")}, not ${account.kind}`,
    )
  }
  return account
}

function resolveNamedAccount(
  draft: BudgetDoc,
  input: NamedAccountInput,
  kind: AccountKind,
  prefix: string,
): { account: Account; created: boolean } {
  if (input.accountId) {
    return {
      account: requireActiveAccount(
        draft,
        input.accountId,
        [kind],
        input.name ?? kind,
      ),
      created: false,
    }
  }

  const name = input.name?.trim()
  if (!name) throw new Error(`${kind} name is required`)
  const existing = Object.values(draft.accountsById).find(
    (account) =>
      account.status === "active" &&
      account.kind === kind &&
      account.name.localeCompare(name, undefined, { sensitivity: "accent" }) ===
        0,
  )
  if (existing) return { account: existing, created: false }

  const id = taskId(prefix)
  applyUpsertAccount(draft, { id, name, kind, status: "active" })
  return { account: draft.accountsById[id], created: true }
}

export type RecordExpenseInput = {
  entryId?: string
  description: string
  effectiveAt: string
  amountMinor: number
  paymentAccountId: string
  category: NamedAccountInput
}

export function applyRecordExpense(
  draft: BudgetDoc,
  input: RecordExpenseInput,
): TaskResult {
  ensureBudgetDocShape(draft)
  requirePositiveMinor(input.amountMinor, "Expense amount")
  const payment = requireActiveAccount(
    draft,
    input.paymentAccountId,
    ["asset"],
    "Paid from",
  )
  const category = resolveNamedAccount(
    draft,
    input.category,
    "expense",
    "expense",
  )
  const entryId = input.entryId ?? taskId("transaction")

  applyUpsertEntry(draft, {
    id: entryId,
    description: input.description.trim() || category.account.name,
    effectiveAt: input.effectiveAt,
    status: "posted",
    postings: buildBalancingPostings({
      fromAccountId: payment.id,
      toAccountId: category.account.id,
      amountMinor: input.amountMinor,
      currency: draft.defaultCurrency,
      fromRole: "payment",
      toRole: "expense",
    }),
  })

  return {
    accountIds: category.created ? [category.account.id] : [],
    entryIds: [entryId],
    planIds: [],
  }
}

export type RecordIncomeInput = {
  entryId?: string
  description: string
  effectiveAt: string
  amountMinor: number
  depositAccountId: string
  source: NamedAccountInput
}

export function applyRecordIncome(
  draft: BudgetDoc,
  input: RecordIncomeInput,
): TaskResult {
  ensureBudgetDocShape(draft)
  requirePositiveMinor(input.amountMinor, "Income amount")
  const deposit = requireActiveAccount(
    draft,
    input.depositAccountId,
    ["asset"],
    "Deposited to",
  )
  const source = resolveNamedAccount(draft, input.source, "income", "income")
  const entryId = input.entryId ?? taskId("transaction")

  applyUpsertEntry(draft, {
    id: entryId,
    description: input.description.trim() || source.account.name,
    effectiveAt: input.effectiveAt,
    status: "posted",
    postings: buildBalancingPostings({
      fromAccountId: source.account.id,
      toAccountId: deposit.id,
      amountMinor: input.amountMinor,
      currency: draft.defaultCurrency,
      fromRole: "income",
      toRole: "deposit",
    }),
  })

  return {
    accountIds: source.created ? [source.account.id] : [],
    entryIds: [entryId],
    planIds: [],
  }
}

export type RecordTransferInput = {
  entryId?: string
  description: string
  effectiveAt: string
  amountMinor: number
  fromAccountId: string
  toAccountId: string
}

export function applyRecordTransfer(
  draft: BudgetDoc,
  input: RecordTransferInput,
): TaskResult {
  ensureBudgetDocShape(draft)
  requirePositiveMinor(input.amountMinor, "Transfer amount")
  const from = requireActiveAccount(
    draft,
    input.fromAccountId,
    ["asset"],
    "Money came from",
  )
  const to = requireActiveAccount(
    draft,
    input.toAccountId,
    ["asset"],
    "Money moved to",
  )
  const entryId = input.entryId ?? taskId("transaction")

  applyUpsertEntry(draft, {
    id: entryId,
    description: input.description.trim() || "Transfer",
    effectiveAt: input.effectiveAt,
    status: "posted",
    postings: buildBalancingPostings({
      fromAccountId: from.id,
      toAccountId: to.id,
      amountMinor: input.amountMinor,
      currency: draft.defaultCurrency,
      fromRole: "transfer-from",
      toRole: "transfer-to",
    }),
  })

  return { accountIds: [], entryIds: [entryId], planIds: [] }
}

export type CreateSalaryInput = {
  planId?: string
  name: string
  amountMinor: number
  depositAccountId: string
  source: NamedAccountInput
  schedule?: Schedule
  startAt?: string
}

export function applyCreateSalary(
  draft: BudgetDoc,
  input: CreateSalaryInput,
): TaskResult {
  ensureBudgetDocShape(draft)
  requirePositiveMinor(input.amountMinor, "Typical salary")
  const deposit = requireActiveAccount(
    draft,
    input.depositAccountId,
    ["asset"],
    "Deposited to",
  )
  const source = resolveNamedAccount(draft, input.source, "income", "income")
  const planId = input.planId ?? taskId("salary")

  applyUpsertPlan(draft, {
    id: planId,
    name: input.name.trim() || source.account.name,
    kind: "income",
    status: "active",
    amountOrFormula: {
      type: "fixed",
      money: money(input.amountMinor, draft.defaultCurrency),
    },
    schedule:
      input.schedule ??
      createPaydaySchedule({
        timezone: draft.timezone,
        startAt: input.startAt,
      }),
    linkedAccountIds: [source.account.id, deposit.id],
    occurrenceIds: [],
  })

  return {
    accountIds: source.created ? [source.account.id] : [],
    entryIds: [],
    planIds: [planId],
  }
}

export type CreateSubscriptionInput = {
  planId?: string
  name: string
  amountMinor: number
  paymentAccountId: string
  category: NamedAccountInput
  schedule: Schedule
}

export function applyCreateSubscription(
  draft: BudgetDoc,
  input: CreateSubscriptionInput,
): TaskResult {
  ensureBudgetDocShape(draft)
  requirePositiveMinor(input.amountMinor, "Subscription amount")
  const payment = requireActiveAccount(
    draft,
    input.paymentAccountId,
    ["asset"],
    "Paid from",
  )
  const category = resolveNamedAccount(
    draft,
    input.category,
    "expense",
    "expense",
  )
  const planId = input.planId ?? taskId("subscription")

  applyUpsertPlan(draft, {
    id: planId,
    name: input.name.trim() || category.account.name,
    kind: "subscription",
    status: "active",
    amountOrFormula: {
      type: "fixed",
      money: money(input.amountMinor, draft.defaultCurrency),
    },
    schedule: input.schedule,
    linkedAccountIds: [payment.id, category.account.id],
    occurrenceIds: [],
  })

  return {
    accountIds: category.created ? [category.account.id] : [],
    entryIds: [],
    planIds: [planId],
  }
}

export type CreateDebtRepaymentInput = {
  planId?: string
  openingEntryId?: string
  name: string
  paymentAmountMinor: number
  originalAmountMinor?: number
  effectiveAt?: string
  paymentAccountId: string
  liability: NamedAccountInput
  purchaseCategory?: NamedAccountInput
  schedule: Schedule
}

export function applyCreateDebtRepayment(
  draft: BudgetDoc,
  input: CreateDebtRepaymentInput,
): TaskResult {
  ensureBudgetDocShape(draft)
  requirePositiveMinor(input.paymentAmountMinor, "Payment amount")
  const payment = requireActiveAccount(
    draft,
    input.paymentAccountId,
    ["asset"],
    "Paid from",
  )
  const liability = resolveNamedAccount(
    draft,
    input.liability,
    "liability",
    "liability",
  )

  if (
    liability.created &&
    (input.originalAmountMinor === undefined || !input.effectiveAt)
  ) {
    delete draft.accountsById[liability.account.id]
    throw new Error(
      "A new debt needs its original amount and the date it began",
    )
  }

  const accountIds = liability.created ? [liability.account.id] : []
  const entryIds: string[] = []

  if (input.originalAmountMinor !== undefined) {
    requirePositiveMinor(input.originalAmountMinor, "Original debt")
    if (!input.effectiveAt) {
      throw new Error("Original debt date is required")
    }
    const purchase = resolveNamedAccount(
      draft,
      input.purchaseCategory ?? { name: input.name },
      "expense",
      "expense",
    )
    if (purchase.created) accountIds.push(purchase.account.id)
    const openingEntryId = input.openingEntryId ?? taskId("debt-opening")
    applyUpsertEntry(draft, {
      id: openingEntryId,
      description: `${input.name.trim() || liability.account.name} — original amount`,
      effectiveAt: input.effectiveAt,
      status: "posted",
      postings: buildBalancingPostings({
        fromAccountId: liability.account.id,
        toAccountId: purchase.account.id,
        amountMinor: input.originalAmountMinor,
        currency: draft.defaultCurrency,
        fromRole: "principal",
        toRole: "expense",
      }),
    })
    entryIds.push(openingEntryId)
  }

  const planId = input.planId ?? taskId("debt-repayment")
  applyUpsertPlan(draft, {
    id: planId,
    name: input.name.trim() || liability.account.name,
    kind: "repayment",
    status: "active",
    amountOrFormula: {
      type: "fixed",
      money: money(input.paymentAmountMinor, draft.defaultCurrency),
    },
    schedule: input.schedule,
    linkedAccountIds: [payment.id, liability.account.id],
    occurrenceIds: [],
  })

  return { accountIds, entryIds, planIds: [planId] }
}

export type ResetAccountBalanceInput = {
  accountId: string
  entryId?: string
  description?: string
  /** Financial date for the adjusting Entry (ISO). Defaults to now. */
  effectiveAt?: string
  /** Where the balancing effect lands. Defaults to auto Balance adjustments. */
  offsetAccountId?: string
  /** Name used when creating the default offset expense account. */
  offsetAccountName?: string
}

/**
 * Zero an Account’s posted signed balance by posting one adjusting Entry.
 * Does not delete or void prior history. No-op when already 0.
 */
export function applyResetAccountBalance(
  draft: BudgetDoc,
  input: ResetAccountBalanceInput,
): TaskResult {
  ensureBudgetDocShape(draft)
  const account = draft.accountsById[input.accountId]
  if (!account || account.status !== "active") {
    throw new Error("Account must be an active account")
  }
  if (input.offsetAccountId && input.offsetAccountId === input.accountId) {
    throw new Error("Offset account must differ from the account being reset")
  }

  const currency = draft.defaultCurrency
  const balance = accountPostedBalanceMinor(draft, account.id, currency)
  if (balance === 0) {
    return { accountIds: [], entryIds: [], planIds: [] }
  }

  const amountMinor = Math.abs(balance)
  const accountIds: string[] = []
  let offset: Account

  if (input.offsetAccountId) {
    offset = requireActiveAccount(
      draft,
      input.offsetAccountId,
      ["asset", "liability", "income", "expense"],
      "Offset",
    )
  } else {
    const offsetName =
      input.offsetAccountName?.trim() || BALANCE_ADJUSTMENTS_ACCOUNT_NAME
    const existing = Object.values(draft.accountsById).find(
      (candidate) =>
        candidate.status === "active" &&
        candidate.kind === "expense" &&
        candidate.name.localeCompare(offsetName, undefined, {
          sensitivity: "accent",
        }) === 0,
    )
    if (existing?.id === account.id) {
      throw new Error(
        "Choose another account for the balancing adjustment",
      )
    }
    const resolved = resolveNamedAccount(
      draft,
      { name: offsetName },
      "expense",
      "adjustment",
    )
    offset = resolved.account
    if (resolved.created) accountIds.push(offset.id)
  }

  // Signed balance B needs posting −B on the target to reach 0.
  // B > 0 → credit target (from); B < 0 → debit target (to).
  const fromAccountId = balance > 0 ? account.id : offset.id
  const toAccountId = balance > 0 ? offset.id : account.id
  const entryId = input.entryId ?? taskId("adjustment")

  applyUpsertEntry(draft, {
    id: entryId,
    description:
      input.description?.trim() || `Reset ${account.name} to zero`,
    effectiveAt: input.effectiveAt ?? new Date().toISOString(),
    status: "posted",
    postings: buildBalancingPostings({
      fromAccountId,
      toAccountId,
      amountMinor,
      currency,
      fromRole: "adjustment",
      toRole: "adjustment",
    }),
  })

  return { accountIds, entryIds: [entryId], planIds: [] }
}

export function planSetupIssue(doc: BudgetDoc, plan: Plan): string | null {
  if (plan.status !== "active") return null
  if (!plan.schedule) return "Add a schedule"
  if (plan.amountOrFormula.type === "extension") return "Set an amount"
  if (
    plan.amountOrFormula.type === "fixed" &&
    plan.amountOrFormula.money.amountMinor <= 0
  ) {
    return "Set an amount"
  }
  if (plan.linkedAccountIds.length < 2) {
    return "Choose where the money comes from and where it goes"
  }

  const [from, to] = plan.linkedAccountIds.map(
    (accountId) => doc.accountsById[accountId],
  )
  if (!from || !to) return "Reconnect missing accounts"
  if (from.status !== "active" || to.status !== "active") {
    return "Replace an archived account"
  }

  if (plan.kind === "income" && (from.kind !== "income" || to.kind !== "asset")) {
    return "Choose an income source and a deposit account"
  }
  if (
    plan.kind === "subscription" &&
    (from.kind !== "asset" || to.kind !== "expense")
  ) {
    return "Choose a payment account and spending category"
  }
  if (
    plan.kind === "repayment" &&
    (from.kind !== "asset" || to.kind !== "liability")
  ) {
    return "Choose a payment account and who you owe"
  }
  if (plan.kind === "repayment") {
    const hasPrincipal = Object.values(doc.entriesById ?? {}).some(
      (entry) =>
        entry.status === "posted" &&
        entry.postings.some(
          (posting) =>
            posting.accountId === to.id && posting.money.amountMinor < 0,
        ),
    )
    if (!hasPrincipal) return "Add the original amount owed"
  }
  return null
}
