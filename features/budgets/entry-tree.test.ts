import { beforeAll, describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { join } from "node:path"

import {
  applyCreateSalary,
  applyCreateSubscription,
  applyCreateDebtRepayment,
  buildBalancingPostings,
  buildDebtsSheet,
  buildPaydaySheet,
  buildRecurringSheet,
  confirmPaydayChildren,
  createBudgetDoc,
  createPaydaySchedule,
  listChildEntries,
  money,
  paydayParentEntryId,
  preparePayday,
  subscriptionBurnMinor,
  upsertAccount,
  upsertEntry,
} from "./index"
import { ensureAutomergeWasm } from "./repo/ensure-wasm"
import * as Automerge from "@automerge/automerge/slim"

beforeAll(async () => {
  await ensureAutomergeWasm()
})

function withAccounts() {
  let doc = createBudgetDoc({
    id: "b1",
    name: "Test",
    timezone: "Asia/Manila",
    defaultCurrency: "PHP",
  })
  doc = upsertAccount(doc, { id: "checking", name: "Checking", kind: "asset" })
  return doc
}

describe("Entry.parentId nesting", () => {
  test("sets parent, rejects Account parents, self, and cycles", () => {
    let doc = withAccounts()
    doc = upsertAccount(doc, { id: "food", name: "Food", kind: "expense" })

    const pair = buildBalancingPostings({
      fromAccountId: "checking",
      toAccountId: "food",
      amountMinor: 1000,
      currency: "PHP",
    })

    doc = upsertEntry(doc, {
      id: "parent",
      description: "Group",
      effectiveAt: "2026-09-15T12:00:00.000Z",
      status: "proposed",
      postings: [],
    })
    expect(doc.entriesById.parent.postings).toEqual([])

    doc = upsertEntry(doc, {
      id: "child",
      description: "Lunch",
      effectiveAt: "2026-09-15T12:00:00.000Z",
      status: "proposed",
      postings: pair,
      parentId: "parent",
    })
    expect(doc.entriesById.child.parentId).toBe("parent")
    expect(listChildEntries(doc, "parent").map((e) => e.id)).toEqual(["child"])

    expect(() =>
      upsertEntry(doc, {
        id: "bad-account",
        description: "nope",
        effectiveAt: "2026-09-15T12:00:00.000Z",
        status: "proposed",
        postings: pair,
        parentId: "checking",
      }),
    ).toThrow(/not an Account/)

    expect(() =>
      upsertEntry(doc, {
        id: "parent",
        description: "Group",
        effectiveAt: "2026-09-15T12:00:00.000Z",
        status: "proposed",
        postings: [],
        parentId: "parent",
      }),
    ).toThrow(/its own parent/)

    expect(() =>
      upsertEntry(doc, {
        id: "parent",
        description: "Group",
        effectiveAt: "2026-09-15T12:00:00.000Z",
        status: "proposed",
        postings: [],
        parentId: "child",
      }),
    ).toThrow(/cycle/)

    expect(() =>
      upsertEntry(doc, {
        id: "posted-empty",
        description: "Posted group",
        effectiveAt: "2026-09-15T12:00:00.000Z",
        status: "posted",
        postings: [],
      }),
    ).toThrow(/proposed grouping/)
  })

  test("payday prepare nests children and confirm posts them only", () => {
    let doc = withAccounts()
    doc = Automerge.change(doc, (draft) => {
      applyCreateSalary(draft, {
        planId: "plan-salary",
        name: "Salary",
        amountMinor: 50_000_00,
        depositAccountId: "checking",
        source: { name: "Acme" },
        schedule: createPaydaySchedule({
          timezone: "Asia/Manila",
          startAt: "2026-09-01",
        }),
      })
      applyCreateSubscription(draft, {
        planId: "plan-netflix",
        name: "Netflix",
        amountMinor: 550_00,
        paymentAccountId: "checking",
        category: { name: "Subscriptions" },
        schedule: createPaydaySchedule({
          timezone: "Asia/Manila",
          startAt: "2026-09-01",
        }),
      })
      applyCreateDebtRepayment(draft, {
        planId: "plan-mom",
        name: "Mom",
        paymentAmountMinor: 2_000_00,
        paymentAccountId: "checking",
        liability: { name: "Mom" },
        originalAmountMinor: 12_000_00,
        effectiveAt: "2026-09-01T12:00:00.000Z",
        schedule: createPaydaySchedule({
          timezone: "Asia/Manila",
          startAt: "2026-09-01",
        }),
      })
    })

    const date = "2026-09-15"
    const prepared = preparePayday(doc, {
      date,
      actualSalaryMinor: 48_000_00,
    })
    doc = prepared.doc
    const parentId = paydayParentEntryId(date)
    expect(prepared.result.parentId).toBe(parentId)
    expect(doc.entriesById[parentId].status).toBe("proposed")
    expect(doc.entriesById[parentId].postings).toEqual([])

    const children = listChildEntries(doc, parentId)
    expect(children.length).toBeGreaterThanOrEqual(2)
    expect(children.every((child) => child.parentId === parentId)).toBe(true)
    expect(children.every((child) => child.status === "proposed")).toBe(true)

    const salary = children.find((child) =>
      child.sourcePlanOccurrenceId?.startsWith("plan-salary:"),
    )
    expect(salary).toBeDefined()
    expect(entryMax(salary!)).toBe(48_000_00)

    const recurring = buildRecurringSheet(doc)
    expect(recurring.rows.some((row) => row.planId === "plan-mom")).toBe(false)
    expect(recurring.rows.some((row) => row.planId === "plan-netflix")).toBe(
      true,
    )
    const netflix = recurring.rows.find((row) => row.planId === "plan-netflix")
    expect(netflix?.children.length).toBeGreaterThan(0)

    const debts = buildDebtsSheet(doc)
    expect(debts.rows.some((row) => row.planId === "plan-mom")).toBe(true)
    expect(debts.rows.some((row) => row.planId === "plan-netflix")).toBe(false)

    const payday = buildPaydaySheet(doc)
    const paydayRow = payday.rows.find((row) => row.entryId === parentId)
    expect(paydayRow).toBeDefined()
    expect(paydayRow?.children.some((child) => child.canConfirm)).toBe(true)

    const confirmed = confirmPaydayChildren(doc, parentId)
    doc = confirmed.doc
    expect(confirmed.postedIds.length).toBe(children.length)
    expect(doc.entriesById[parentId].status).toBe("proposed")
    for (const child of listChildEntries(doc, parentId)) {
      expect(child.status).toBe("posted")
      expect(child.parentId).toBe(parentId)
    }

    expect(subscriptionBurnMinor(doc)).toBe(550_00)

    const afterConfirm = buildPaydaySheet(doc)
    const postedRow = afterConfirm.rows.find((row) => row.entryId === parentId)
    expect(postedRow?.children.every((child) => !child.canConfirm)).toBe(true)
  })
})

describe("sheets + mutations stay Next-free", () => {
  test("kernel modules do not import next", () => {
    const root = join(import.meta.dir)
    const files = [
      "mutations.ts",
      "sheets.ts",
      "payday-prepare.ts",
      "entry-tree.ts",
      "plan-propose.ts",
      "balances.ts",
      "types.ts",
      "index.ts",
    ]
    for (const file of files) {
      const source = readFileSync(join(root, file), "utf8")
      expect(source).not.toMatch(/from ["']next(\/|$)/)
    }
  })
})

function entryMax(entry: { postings: Array<{ money: { amountMinor: number } }> }) {
  return Math.max(
    ...entry.postings.map((posting) => Math.abs(posting.money.amountMinor)),
    0,
  )
}
