import { beforeAll, describe, expect, test } from "bun:test"
import * as Automerge from "@automerge/automerge/slim"

import { createBudgetDoc } from "./document"
import {
  purchaseRemainingMinor,
} from "./entry-tree"
import { upsertAccount } from "./mutations"
import {
  applyRecordNestedRepayment,
  applyRecordPurchase,
} from "./scenario-commands"
import { buildCatalogSheet, buildDebtsSheet } from "./sheets"
import { ensureAutomergeWasm } from "./repo/ensure-wasm"

beforeAll(async () => {
  await ensureAutomergeWasm()
})

describe("nested sheets", () => {
  test("catalog nests Account.parentId folders", () => {
    let doc = createBudgetDoc({
      id: "b1",
      name: "Test",
      defaultCurrency: "PHP",
    })
    doc = upsertAccount(doc, {
      id: "online",
      name: "Online Services",
      kind: "expense",
    })
    doc = upsertAccount(doc, {
      id: "brain",
      name: "Brain",
      kind: "expense",
      parentId: "online",
    })
    doc = upsertAccount(doc, {
      id: "wanikani",
      name: "WaniKani",
      kind: "expense",
      parentId: "brain",
    })

    const sheet = buildCatalogSheet(doc)
    expect(sheet.rows).toHaveLength(1)
    expect(sheet.rows[0]?.title).toBe("Online Services")
    expect(sheet.rows[0]?.children[0]?.title).toBe("Brain")
    expect(sheet.rows[0]?.children[0]?.children[0]?.title).toBe("WaniKani")
  })

  test("debts nest repayment Entries under the purchase Entry", () => {
    let doc = createBudgetDoc({
      id: "b1",
      name: "Test",
      defaultCurrency: "PHP",
    })
    doc = upsertAccount(doc, { id: "cash", name: "Cash", kind: "asset" })
    doc = upsertAccount(doc, { id: "mom", name: "Mom", kind: "liability" })

    doc = Automerge.change(doc, (draft) => {
      applyRecordPurchase(draft, {
        entryId: "headphones",
        description: "Headphones-this-buy",
        effectiveAt: "2026-07-01T12:00:00.000Z",
        amountMinor: 27_999,
        fromAccountId: "mom",
        category: { name: "Gadgets" },
      })
      applyRecordNestedRepayment(draft, {
        entryId: "pay-posted",
        parentId: "headphones",
        description: "2nd July",
        effectiveAt: "2026-07-02T12:00:00.000Z",
        amountMinor: 9_000,
        paymentAccountId: "cash",
        status: "posted",
      })
      applyRecordNestedRepayment(draft, {
        entryId: "pay-proposed",
        parentId: "headphones",
        description: "next payday",
        effectiveAt: "2026-07-15T12:00:00.000Z",
        amountMinor: 9_000,
        paymentAccountId: "cash",
        status: "proposed",
      })
    })

    expect(doc.accountsById.headphones).toBeUndefined()
    expect(purchaseRemainingMinor(doc, "headphones")).toBe(18_999)

    const sheet = buildDebtsSheet(doc)
    expect(sheet.rows).toHaveLength(1)
    expect(sheet.rows[0]?.title).toBe("Headphones-this-buy")
    expect(sheet.rows[0]?.remainingLabel).toBe("189.99 PHP")
    expect(sheet.rows[0]?.children.map((row) => row.title)).toEqual([
      "2nd July",
      "next payday",
    ])
    expect(sheet.rows[0]?.children[1]?.statusLabel).toBe("needs review")
  })

  test("sheets and mutations import without next", async () => {
    const sheetsSource = await Bun.file(
      new URL("./sheets.ts", import.meta.url),
    ).text()
    const mutationsSource = await Bun.file(
      new URL("./mutations.ts", import.meta.url),
    ).text()
    expect(sheetsSource).not.toMatch(/from ["']next/)
    expect(mutationsSource).not.toMatch(/from ["']next/)
  })
})
