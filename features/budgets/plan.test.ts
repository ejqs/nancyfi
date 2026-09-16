import { beforeAll, describe, expect, test } from "bun:test"
import * as Automerge from "@automerge/automerge/slim"

import {
  applyProposePlanOccurrences,
  applySeedCatalogPlanTemplates,
  cancelPlan,
  createBudgetDoc,
  createPlanFromTemplate,
  createPaydaySchedule,
  deletePlanTemplate,
  money,
  proposePlanOccurrences,
  resolvePlanAmountMinor,
  seedCatalogPlanTemplates,
  upsertAccount,
  upsertEntry,
  upsertPlan,
  upsertPlanTemplate,
  buildBalancingPostings,
} from "./index"
import { ensureAutomergeWasm } from "./repo/ensure-wasm"

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
  doc = upsertAccount(doc, { id: "income", name: "Salary", kind: "income" })
  doc = upsertAccount(doc, {
    id: "checking",
    name: "Checking",
    kind: "asset",
  })
  doc = upsertAccount(doc, {
    id: "mom",
    name: "Mom",
    kind: "liability",
  })
  doc = upsertAccount(doc, {
    id: "subs",
    name: "Subscriptions",
    kind: "expense",
  })
  return doc
}

describe("Plans + Plan templates", () => {
  test("upsert Plan with kernel kind, schedule, linked accounts", () => {
    let doc = withAccounts()
    doc = upsertPlan(doc, {
      id: "plan-salary",
      name: "Semi-monthly salary",
      kind: "income",
      amountOrFormula: { type: "fixed", money: money(50_000_00, "PHP") },
      schedule: createPaydaySchedule({ timezone: "Asia/Manila" }),
      linkedAccountIds: ["income", "checking"],
    })

    const plan = doc.plansById["plan-salary"]
    expect(plan.kind).toBe("income")
    expect(plan.status).toBe("active")
    expect(plan.linkedAccountIds).toEqual(["income", "checking"])
    expect(plan.schedule?.anchors).toEqual(["dayOfMonth", "endOfMonth"])
    expect(plan.amountOrFormula.type).toBe("fixed")
  })

  test("CRUD Plan templates and create Plan from template", () => {
    let doc = withAccounts()
    doc = upsertPlanTemplate(doc, {
      id: "tpl-24",
      name: "Installment purchase (24 mo)",
      kind: "repayment",
      labels: ["installment", "24-mo"],
      defaultAmountOrFormula: {
        type: "fixed",
        money: money(2_000_00, "PHP"),
      },
      defaultSchedule: {
        ...createPaydaySchedule({ timezone: "Asia/Manila" }),
        occurrenceCount: 24,
      },
    })

    expect(doc.planTemplatesById["tpl-24"].labels).toEqual([
      "installment",
      "24-mo",
    ])

    doc = createPlanFromTemplate(doc, {
      planId: "plan-phone",
      templateId: "tpl-24",
      linkedAccountIds: ["checking", "mom"],
    })

    const plan = doc.plansById["plan-phone"]
    expect(plan.templateId).toBe("tpl-24")
    expect(plan.kind).toBe("repayment")
    expect(plan.name).toBe("Installment purchase (24 mo)")
    expect(plan.schedule?.occurrenceCount).toBe(24)
    expect(plan.amountOrFormula.type).toBe("fixed")
    if (plan.amountOrFormula.type === "fixed") {
      expect(plan.amountOrFormula.money.amountMinor).toBe(200_000)
    }

    // Deleting the template does not erase the Plan's copied fields
    doc = deletePlanTemplate(doc, "tpl-24")
    expect(doc.planTemplatesById["tpl-24"]).toBeUndefined()
    expect(doc.plansById["plan-phone"].amountOrFormula.type).toBe("fixed")
    expect(doc.plansById["plan-phone"].templateId).toBe("tpl-24")
  })

  test("seed catalog templates into budget", () => {
    let doc = createBudgetDoc({ id: "b1", name: "Test" })
    const seeded = seedCatalogPlanTemplates(doc, {
      timezone: "Asia/Manila",
      catalogKeys: [
        "catalog:salary-semi-monthly",
        "catalog:repayment-installment-24",
      ],
    })
    doc = seeded.doc
    expect(seeded.seededIds).toHaveLength(2)
    expect(doc.planTemplatesById["catalog:salary-semi-monthly"].kind).toBe(
      "income",
    )
    expect(
      doc.planTemplatesById["catalog:repayment-installment-24"].labels,
    ).toContain("24-mo")

    // Idempotent skip when overwrite=false
    const again = seedCatalogPlanTemplates(doc, {
      catalogKeys: ["catalog:salary-semi-monthly"],
    })
    expect(again.skippedIds).toEqual(["catalog:salary-semi-monthly"])
  })

  test("cancel Plan stops proposals; preserves posted Entries and liability", () => {
    let doc = withAccounts()
    doc = upsertPlan(doc, {
      id: "plan-sub",
      name: "Streaming",
      kind: "subscription",
      amountOrFormula: { type: "fixed", money: money(499_00, "PHP") },
      schedule: createPaydaySchedule({
        timezone: "Asia/Manila",
        startAt: "2026-09-01",
      }),
      linkedAccountIds: ["checking", "subs"],
    })

    // Seed a liability (Mom paid annual) + a posted payment
    doc = upsertEntry(doc, {
      id: "e-principal",
      description: "Annual charge via Mom",
      effectiveAt: "2026-09-01T12:00:00.000Z",
      status: "posted",
      postings: buildBalancingPostings({
        fromAccountId: "mom",
        toAccountId: "subs",
        amountMinor: 12_000_00,
        currency: "PHP",
        fromRole: "principal",
        toRole: "expense",
      }),
    })

    const proposed = proposePlanOccurrences(doc, {
      planId: "plan-sub",
      range: { from: "2026-09-01", to: "2026-09-30" },
    })
    doc = proposed.doc
    expect(proposed.result.createdEntryIds.length).toBeGreaterThan(0)
    const firstEntryId = proposed.result.createdEntryIds[0]
    expect(doc.entriesById[firstEntryId].status).toBe("proposed")

    // Post one occurrence
    const entry = doc.entriesById[firstEntryId]
    doc = upsertEntry(doc, {
      id: entry.id,
      description: entry.description,
      effectiveAt: entry.effectiveAt,
      status: "posted",
      postings: entry.postings.map((p) => ({
        accountId: p.accountId,
        money: {
          amountMinor: p.money.amountMinor,
          currency: p.money.currency,
        },
        ...(p.role ? { role: p.role } : {}),
      })),
      sourcePlanOccurrenceId: entry.sourcePlanOccurrenceId,
    })

    doc = cancelPlan(doc, "plan-sub")
    expect(doc.plansById["plan-sub"].status).toBe("cancelled")

    // Posted entry + liability principal remain
    expect(doc.entriesById[firstEntryId].status).toBe("posted")
    expect(doc.entriesById["e-principal"].status).toBe("posted")
    expect(doc.accountsById.mom.kind).toBe("liability")

    // No new proposals after cancel
    const afterCancel = proposePlanOccurrences(doc, {
      planId: "plan-sub",
      range: { from: "2026-10-01", to: "2026-10-31" },
    })
    expect(afterCancel.result.createdEntryIds).toEqual([])
  })

  test("Plans generate proposed Entries; idempotent occurrence ids", () => {
    let doc = withAccounts()
    doc = upsertPlan(doc, {
      id: "plan-salary",
      name: "Salary",
      kind: "income",
      amountOrFormula: { type: "fixed", money: money(50_000_00, "PHP") },
      schedule: createPaydaySchedule({
        timezone: "Asia/Manila",
        startAt: "2026-09-01",
      }),
      linkedAccountIds: ["income", "checking"],
    })

    const first = proposePlanOccurrences(doc, {
      planId: "plan-salary",
      range: { from: "2026-09-01", to: "2026-09-30" },
    })
    doc = first.doc
    expect(first.result.createdEntryIds.length).toBe(2) // 15th + EOM

    for (const id of first.result.createdEntryIds) {
      expect(doc.entriesById[id].status).toBe("proposed")
      expect(doc.entriesById[id].sourcePlanOccurrenceId).toBeTruthy()
    }

    const second = proposePlanOccurrences(doc, {
      planId: "plan-salary",
      range: { from: "2026-09-01", to: "2026-09-30" },
    })
    expect(second.result.createdEntryIds).toEqual([])
    expect(second.result.skippedOccurrenceIds.length).toBe(2)
  })

  test("salary Plan typical amount is not rewritten for Entry variance", () => {
    let doc = withAccounts()
    doc = upsertPlan(doc, {
      id: "plan-salary",
      name: "Salary",
      kind: "income",
      amountOrFormula: { type: "fixed", money: money(50_000_00, "PHP") },
      schedule: createPaydaySchedule({
        timezone: "Asia/Manila",
        startAt: "2026-09-01",
      }),
      linkedAccountIds: ["income", "checking"],
    })

    const { doc: withProposal, result } = proposePlanOccurrences(doc, {
      planId: "plan-salary",
      range: { from: "2026-09-01", to: "2026-09-15" },
    })
    doc = withProposal
    const entryId = result.createdEntryIds[0]
    const entry = doc.entriesById[entryId]

    // Owner edits proposed Entry to actual pay (overtime) — Plan unchanged
    doc = upsertEntry(doc, {
      id: entry.id,
      description: entry.description,
      effectiveAt: entry.effectiveAt,
      status: "proposed",
      postings: buildBalancingPostings({
        fromAccountId: "income",
        toAccountId: "checking",
        amountMinor: 52_500_00,
        currency: "PHP",
        fromRole: "income",
        toRole: "deposit",
      }),
      sourcePlanOccurrenceId: entry.sourcePlanOccurrenceId,
    })

    const plan = doc.plansById["plan-salary"]
    expect(plan.amountOrFormula.type).toBe("fixed")
    if (plan.amountOrFormula.type === "fixed") {
      expect(plan.amountOrFormula.money.amountMinor).toBe(5_000_000)
    }
    expect(
      Math.abs(doc.entriesById[entryId].postings[0].money.amountMinor),
    ).toBe(5_250_000)

    // Percent allocation uses actual Entry base, not Plan typical
    const resolved = resolvePlanAmountMinor(
      doc,
      {
        ...plan,
        amountOrFormula: { type: "percent", percentBps: 1000 },
      },
      { baseAmountMinor: 5_250_000 },
    )
    expect(resolved.amountMinor).toBe(525_000) // 10% of actual
  })

  test("draft-safe catalog seed + propose inside one change", () => {
    let doc = withAccounts()
    doc = Automerge.change(doc, (draft) => {
      applySeedCatalogPlanTemplates(draft, {
        catalogKeys: ["catalog:salary-semi-monthly"],
        timezone: "Asia/Manila",
      })
    })

    doc = createPlanFromTemplate(doc, {
      planId: "p1",
      templateId: "catalog:salary-semi-monthly",
      linkedAccountIds: ["income", "checking"],
      schedule: createPaydaySchedule({
        timezone: "Asia/Manila",
        startAt: "2026-09-01",
      }),
    })

    doc = Automerge.change(doc, (draft) => {
      applyProposePlanOccurrences(draft, {
        planId: "p1",
        range: { from: "2026-09-01", to: "2026-09-30" },
      })
    })

    expect(
      Object.values(doc.entriesById).every((e) => e.status === "proposed"),
    ).toBe(true)
    expect(Object.keys(doc.entriesById).length).toBe(2)
  })
})
