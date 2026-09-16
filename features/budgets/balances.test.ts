import { describe, expect, test } from "bun:test"

import {
  countEntriesByStatus,
  listAccountBalances,
  listDebtDetails,
} from "./balances"
import { createBudgetDoc, money } from "./document"
import {
  upsertAccount,
  upsertEntry,
  upsertPlan,
  buildBalancingPostings,
} from "./mutations"
import { createPaydaySchedule } from "./schedule"

describe("balances helpers", () => {
  test("lists posted balances and entry status counts", () => {
    let doc = createBudgetDoc({
      id: "b1",
      name: "Test",
      timezone: "Asia/Manila",
      defaultCurrency: "PHP",
    })
    doc = upsertAccount(doc, {
      id: "cash",
      name: "Cash",
      kind: "asset",
      status: "active",
    })
    doc = upsertAccount(doc, {
      id: "food",
      name: "Food",
      kind: "expense",
      status: "active",
    })
    doc = upsertEntry(doc, {
      id: "e1",
      description: "Lunch",
      effectiveAt: "2026-09-16T12:00:00.000Z",
      status: "posted",
      postings: buildBalancingPostings({
        fromAccountId: "cash",
        toAccountId: "food",
        amountMinor: 25000,
        currency: "PHP",
      }),
    })
    doc = upsertEntry(doc, {
      id: "e2",
      description: "Pending",
      effectiveAt: "2026-09-16T12:00:00.000Z",
      status: "proposed",
      postings: buildBalancingPostings({
        fromAccountId: "cash",
        toAccountId: "food",
        amountMinor: 1000,
        currency: "PHP",
      }),
    })

    const balances = listAccountBalances(doc)
    const cash = balances.find((row) => row.account.id === "cash")
    const food = balances.find((row) => row.account.id === "food")
    expect(cash?.balanceMinor).toBe(-25000)
    expect(food?.balanceMinor).toBe(25000)

    expect(countEntriesByStatus(doc)).toEqual({
      proposed: 1,
      posted: 1,
      void: 0,
    })
  })

  test("derives debt original, paid, and remaining from posted history", () => {
    let doc = createBudgetDoc({
      id: "b1",
      name: "Test",
      timezone: "Asia/Manila",
      defaultCurrency: "PHP",
    })
    doc = upsertAccount(doc, {
      id: "cash",
      name: "Cash",
      kind: "asset",
    })
    doc = upsertAccount(doc, {
      id: "mom",
      name: "Owed to Mom",
      kind: "liability",
    })
    doc = upsertAccount(doc, {
      id: "purchase",
      name: "Annual subscription",
      kind: "expense",
    })
    doc = upsertEntry(doc, {
      id: "principal",
      description: "Original amount",
      effectiveAt: "2026-09-01T12:00:00.000Z",
      status: "posted",
      postings: buildBalancingPostings({
        fromAccountId: "mom",
        toAccountId: "purchase",
        amountMinor: 120_000,
        currency: "PHP",
      }),
    })
    doc = upsertEntry(doc, {
      id: "payment",
      description: "Payment",
      effectiveAt: "2026-09-15T12:00:00.000Z",
      status: "posted",
      postings: buildBalancingPostings({
        fromAccountId: "cash",
        toAccountId: "mom",
        amountMinor: 10_000,
        currency: "PHP",
      }),
    })
    doc = upsertPlan(doc, {
      id: "repayment",
      name: "Debt to Mom",
      kind: "repayment",
      amountOrFormula: {
        type: "fixed",
        money: money(10_000, "PHP"),
      },
      schedule: createPaydaySchedule({ timezone: "Asia/Manila" }),
      linkedAccountIds: ["cash", "mom"],
    })

    expect(listDebtDetails(doc)).toEqual([
      expect.objectContaining({
        originalMinor: 120_000,
        paidMinor: 10_000,
        remainingMinor: 110_000,
        currency: "PHP",
      }),
    ])
  })
})
