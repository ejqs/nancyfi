import { beforeAll, describe, expect, test } from "bun:test"
import * as Automerge from "@automerge/automerge/slim"

import { createBudgetDoc } from "./document"
import { upsertAccount, upsertPlan } from "./mutations"
import { accountPostedBalanceMinor } from "./plan-propose"
import {
  applyCreateDebtRepayment,
  applyCreateSalary,
  applyCreateSubscription,
  applyRecordExpense,
  applyRecordIncome,
  applyRecordTransfer,
  planSetupIssue,
} from "./scenario-commands"
import { createPaydaySchedule } from "./schedule"
import { ensureAutomergeWasm } from "./repo/ensure-wasm"

beforeAll(async () => {
  await ensureAutomergeWasm()
})

function withMoneyAccounts() {
  let doc = createBudgetDoc({
    id: "budget",
    name: "Household",
    timezone: "Asia/Manila",
    defaultCurrency: "PHP",
  })
  doc = upsertAccount(doc, {
    id: "checking",
    name: "BPI",
    kind: "asset",
  })
  doc = upsertAccount(doc, {
    id: "cash",
    name: "Cash",
    kind: "asset",
  })
  return doc
}

describe("scenario-safe task commands", () => {
  test("records expenses and income without exposing posting direction", () => {
    let doc = withMoneyAccounts()
    doc = Automerge.change(doc, (draft) => {
      applyRecordExpense(draft, {
        entryId: "lunch",
        description: "Lunch",
        effectiveAt: "2026-09-17T12:00:00.000Z",
        amountMinor: 25_000,
        paymentAccountId: "checking",
        category: { name: "Food" },
      })
      applyRecordIncome(draft, {
        entryId: "salary",
        description: "Payday",
        effectiveAt: "2026-09-17T12:00:00.000Z",
        amountMinor: 3_300_000,
        depositAccountId: "checking",
        source: { name: "Company" },
      })
    })

    const food = Object.values(doc.accountsById).find((a) => a.name === "Food")
    const company = Object.values(doc.accountsById).find(
      (a) => a.name === "Company",
    )
    expect(food?.kind).toBe("expense")
    expect(company?.kind).toBe("income")
    expect(doc.entriesById.lunch.status).toBe("posted")
    expect(doc.entriesById.salary.status).toBe("posted")
    expect(
      accountPostedBalanceMinor(doc, "checking", "PHP"),
    ).toBe(3_275_000)
  })

  test("records transfers only between active money accounts", () => {
    let doc = withMoneyAccounts()
    doc = Automerge.change(doc, (draft) => {
      applyRecordTransfer(draft, {
        entryId: "move",
        description: "Move to cash",
        effectiveAt: "2026-09-17T12:00:00.000Z",
        amountMinor: 50_000,
        fromAccountId: "checking",
        toAccountId: "cash",
      })
    })

    expect(doc.entriesById.move.status).toBe("posted")
    expect(accountPostedBalanceMinor(doc, "checking", "PHP")).toBe(-50_000)
    expect(accountPostedBalanceMinor(doc, "cash", "PHP")).toBe(50_000)
  })

  test("creates salary and subscription with compatible linked accounts", () => {
    let doc = withMoneyAccounts()
    doc = Automerge.change(doc, (draft) => {
      applyCreateSalary(draft, {
        planId: "salary-plan",
        name: "Company salary",
        amountMinor: 3_300_000,
        depositAccountId: "checking",
        source: { name: "Company" },
        startAt: "2026-09-01",
      })
      applyCreateSubscription(draft, {
        planId: "streaming-plan",
        name: "Streaming",
        amountMinor: 49_900,
        paymentAccountId: "checking",
        category: { name: "Subscriptions" },
        schedule: createPaydaySchedule({
          timezone: draft.timezone,
          startAt: "2026-09-01",
        }),
      })
    })

    const salary = doc.plansById["salary-plan"]
    const subscription = doc.plansById["streaming-plan"]
    expect(doc.accountsById[salary.linkedAccountIds[0]].kind).toBe("income")
    expect(doc.accountsById[salary.linkedAccountIds[1]].kind).toBe("asset")
    expect(doc.accountsById[subscription.linkedAccountIds[0]].kind).toBe(
      "asset",
    )
    expect(doc.accountsById[subscription.linkedAccountIds[1]].kind).toBe(
      "expense",
    )
    expect(planSetupIssue(doc, salary)).toBeNull()
    expect(planSetupIssue(doc, subscription)).toBeNull()
  })

  test("creates debt principal, liability, and repayment atomically", () => {
    let doc = withMoneyAccounts()
    doc = Automerge.change(doc, (draft) => {
      applyCreateDebtRepayment(draft, {
        planId: "mom-plan",
        openingEntryId: "mom-principal",
        name: "Debt to Mom",
        originalAmountMinor: 120_000,
        paymentAmountMinor: 10_000,
        effectiveAt: "2026-09-01T12:00:00.000Z",
        paymentAccountId: "checking",
        liability: { name: "Owed to Mom" },
        purchaseCategory: { name: "Annual subscriptions" },
        schedule: createPaydaySchedule({
          timezone: draft.timezone,
          startAt: "2026-09-01",
        }),
      })
    })

    const plan = doc.plansById["mom-plan"]
    const liability = doc.accountsById[plan.linkedAccountIds[1]]
    expect(liability.kind).toBe("liability")
    expect(planSetupIssue(doc, plan)).toBeNull()
    expect(accountPostedBalanceMinor(doc, liability.id, "PHP")).toBe(-120_000)
    expect(doc.entriesById["mom-principal"].status).toBe("posted")
  })

  test("rejects repayment Plans linked only between assets", () => {
    const doc = withMoneyAccounts()
    expect(() =>
      upsertPlan(doc, {
        id: "invalid",
        name: "Debt to Mom",
        kind: "repayment",
        amountOrFormula: {
          type: "fixed",
          money: { amountMinor: 10_000, currency: "PHP" },
        },
        schedule: createPaydaySchedule({ timezone: "Asia/Manila" }),
        linkedAccountIds: ["checking", "cash"],
      }),
    ).toThrow(/asset → liability/)
  })

  test("flags repayment Plans that have no posted principal", () => {
    let doc = withMoneyAccounts()
    doc = upsertAccount(doc, {
      id: "mom",
      name: "Owed to Mom",
      kind: "liability",
    })
    doc = upsertPlan(doc, {
      id: "repayment",
      name: "Debt to Mom",
      kind: "repayment",
      amountOrFormula: {
        type: "fixed",
        money: { amountMinor: 10_000, currency: "PHP" },
      },
      schedule: createPaydaySchedule({ timezone: "Asia/Manila" }),
      linkedAccountIds: ["checking", "mom"],
    })

    expect(planSetupIssue(doc, doc.plansById.repayment)).toBe(
      "Add the original amount owed",
    )
  })

  test("flags incompatible legacy repayment Plans for guided repair", () => {
    let doc = withMoneyAccounts()
    doc = Automerge.change(doc, (draft) => {
      draft.plansById.legacy = {
        id: "legacy",
        name: "Debt to Mom",
        kind: "repayment",
        status: "active",
        amountOrFormula: {
          type: "fixed",
          money: { amountMinor: 10_000, currency: "PHP" },
        },
        schedule: createPaydaySchedule({ timezone: draft.timezone }),
        linkedAccountIds: ["checking", "cash"],
        occurrenceIds: [],
      }
    })

    expect(planSetupIssue(doc, doc.plansById.legacy)).toBe(
      "Choose a payment account and who you owe",
    )
  })
})
