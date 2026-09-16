import { beforeAll, describe, expect, test } from "bun:test"
import * as Automerge from "@automerge/automerge/slim"

import {
  assertPostingsBalanced,
  buildBalancingPostings,
  createBudgetDoc,
  loadBudgetSchema,
  money,
  upsertAccount,
  upsertEntry,
  upsertPlan,
  upsertRuleApplied,
  upsertRuleRun,
  voidEntry,
} from "./index"
import { ensureAutomergeWasm } from "./repo/ensure-wasm"

beforeAll(async () => {
  await ensureAutomergeWasm()
})

describe("budget Automerge data model", () => {
  test("schema init loads empty maps with shared version", () => {
    const doc = loadBudgetSchema()
    expect(doc.schemaVersion).toBe(1)
    expect(doc.defaultCurrency).toBe("PHP")
    expect(doc.accountsById).toEqual({})
    expect(doc.entriesById).toEqual({})
    expect(doc.plansById).toEqual({})
    expect(doc.planTemplatesById).toEqual({})
    expect(doc.rulesAppliedById).toEqual({})
    expect(doc.ruleRunsById).toEqual({})
  })

  test("independent schema loads share ancestry and merge concurrent accounts", () => {
    // Two devices load the same hard-coded init bytes (no prior sync).
    const left = createBudgetDoc({ id: "budget-1", name: "Household" })
    const rightBase = loadBudgetSchema()
    const right = Automerge.change(rightBase, (doc) => {
      doc.id = "budget-1"
      doc.name = "Household"
    })

    const left2 = upsertAccount(left, {
      id: "acc-checking",
      name: "Checking",
      kind: "asset",
    })
    const right2 = upsertAccount(right, {
      id: "acc-salary",
      name: "Salary",
      kind: "income",
    })

    const merged = Automerge.merge(left2, right2)
    expect(Object.keys(merged.accountsById).sort()).toEqual([
      "acc-checking",
      "acc-salary",
    ])
    expect(merged.id).toBe("budget-1")
  })

  test("money rejects floats", () => {
    expect(() => money(1.5, "PHP")).toThrow(/integer/)
  })

  test("balanced entry posts with integer minor units", () => {
    let doc = createBudgetDoc({ id: "b1", name: "Test", defaultCurrency: "PHP" })
    doc = upsertAccount(doc, {
      id: "cash",
      name: "Cash",
      kind: "asset",
    })
    doc = upsertAccount(doc, {
      id: "groceries",
      name: "Groceries",
      kind: "expense",
      parentId: undefined,
    })

    doc = upsertEntry(doc, {
      id: "e1",
      description: "Market run",
      effectiveAt: "2026-09-16T00:00:00.000Z",
      status: "posted",
      postings: [
        { accountId: "cash", money: money(-25000, "PHP"), role: "payment" },
        { accountId: "groceries", money: money(25000, "PHP"), role: "expense" },
      ],
    })

    const entry = doc.entriesById.e1
    expect(entry.status).toBe("posted")
    expect(entry.postings).toHaveLength(2)
    expect(entry.postings[0].money.amountMinor).toBe(-25000)
    expect(entry.postings[1].money.amountMinor).toBe(25000)
    assertPostingsBalanced([...entry.postings])
  })

  test("unbalanced entry is rejected", () => {
    let doc = createBudgetDoc({ id: "b1", name: "Test" })
    doc = upsertAccount(doc, { id: "a", name: "A", kind: "asset" })
    doc = upsertAccount(doc, { id: "b", name: "B", kind: "expense" })

    expect(() =>
      upsertEntry(doc, {
        id: "bad",
        description: "nope",
        effectiveAt: "2026-09-16T00:00:00.000Z",
        status: "posted",
        postings: [
          { accountId: "a", money: money(-100, "PHP") },
          { accountId: "b", money: money(50, "PHP") },
        ],
      }),
    ).toThrow(/do not balance/)
  })

  test("simple form helper builds a balancing posting pair", () => {
    const postings = buildBalancingPostings({
      fromAccountId: "cash",
      toAccountId: "groceries",
      amountMinor: 12_500,
      currency: "php",
      fromRole: "payment",
      toRole: "expense",
    })
    expect(postings).toHaveLength(2)
    expect(postings[0].money.amountMinor).toBe(-12_500)
    expect(postings[1].money.amountMinor).toBe(12_500)
    expect(postings[0].money.currency).toBe("PHP")
    assertPostingsBalanced(postings)
  })

  test("void marks posted entry without deleting it", () => {
    let doc = createBudgetDoc({ id: "b1", name: "Test" })
    doc = upsertAccount(doc, { id: "cash", name: "Cash", kind: "asset" })
    doc = upsertAccount(doc, {
      id: "groceries",
      name: "Groceries",
      kind: "expense",
    })
    doc = upsertEntry(doc, {
      id: "e1",
      description: "Market run",
      effectiveAt: "2026-09-16T00:00:00.000Z",
      status: "posted",
      postings: buildBalancingPostings({
        fromAccountId: "cash",
        toAccountId: "groceries",
        amountMinor: 1000,
        currency: "PHP",
      }),
    })

    doc = voidEntry(doc, "e1")
    expect(doc.entriesById.e1).toBeDefined()
    expect(doc.entriesById.e1.status).toBe("void")
    expect(doc.entriesById.e1.postings).toHaveLength(2)
  })

  test("account hierarchy parent can be set and cleared", () => {
    let doc = createBudgetDoc({ id: "b1", name: "Test" })
    doc = upsertAccount(doc, {
      id: "expenses",
      name: "Expenses",
      kind: "expense",
    })
    doc = upsertAccount(doc, {
      id: "food",
      name: "Food",
      kind: "expense",
      parentId: "expenses",
    })
    expect(doc.accountsById.food.parentId).toBe("expenses")

    doc = upsertAccount(doc, {
      id: "food",
      name: "Food",
      kind: "expense",
      parentId: null,
    })
    expect(doc.accountsById.food.parentId).toBeUndefined()
  })

  test("plan kinds and rule application slots", () => {
    let doc = createBudgetDoc({ id: "b1", name: "Test" })
    doc = upsertAccount(doc, { id: "income", name: "Salary", kind: "income" })
    doc = upsertAccount(doc, {
      id: "checking",
      name: "Checking",
      kind: "asset",
    })

    doc = upsertPlan(doc, {
      id: "plan-salary",
      name: "Semi-monthly salary",
      kind: "income",
      amountOrFormula: { type: "fixed", money: money(50_000_00, "PHP") },
      schedule: {
        timezone: "Asia/Manila",
        anchors: ["dayOfMonth", "endOfMonth"],
        dayOfMonth: 15,
        adjustToPreviousWeekday: true,
      },
      linkedAccountIds: ["income", "checking"],
    })

    doc = upsertRuleApplied(doc, {
      id: "ra1",
      ruleId: "builtin-on-plan-occurrence",
      status: "enabled",
    })

    doc = upsertRuleRun(doc, {
      id: "run1",
      ruleId: "builtin-on-plan-occurrence",
      versionHash: "abc",
      occurrenceKey: "2026-09-15",
      status: "succeeded",
      generatedEntryIds: [],
      ranAt: "2026-09-15T00:00:00.000Z",
    })

    expect(doc.plansById["plan-salary"].kind).toBe("income")
    expect(doc.plansById["plan-salary"].amountOrFormula.type).toBe("fixed")
    if (doc.plansById["plan-salary"].amountOrFormula.type === "fixed") {
      expect(doc.plansById["plan-salary"].amountOrFormula.money.amountMinor).toBe(
        5_000_000,
      )
    }
    expect(doc.rulesAppliedById.ra1.status).toBe("enabled")
    expect(doc.ruleRunsById.run1.occurrenceKey).toBe("2026-09-15")
  })

  test("ensureBudgetDocShape backfills missing maps on older docs", async () => {
    const { ensureBudgetDocShape, budgetDocNeedsShapeFix } = await import(
      "./mutations"
    )
    let doc = loadBudgetSchema()
    // Simulate a pre-template doc: Automerge may omit later map fields.
    doc = Automerge.change(doc, (draft) => {
      delete (draft as { planTemplatesById?: unknown }).planTemplatesById
    })
    expect(budgetDocNeedsShapeFix(doc)).toBe(true)
    doc = Automerge.change(doc, (draft) => {
      ensureBudgetDocShape(draft)
    })
    expect(budgetDocNeedsShapeFix(doc)).toBe(false)
    expect(doc.planTemplatesById).toEqual({})
  })
})
