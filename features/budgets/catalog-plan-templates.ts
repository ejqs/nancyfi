/**
 * Shareable catalog Plan templates (recipes).
 * Copy into a budget via `applySeedCatalogPlanTemplates` — same visibility idea as Rules/Lenses.
 *
 * @see features/budgets/docs/data-model.md#plan-template-user--catalog-setup
 */

import type { BudgetDoc, PlanTemplate, Schedule } from "./types"
import { applyUpsertPlanTemplate, ensureBudgetDocShape } from "./mutations"
import { createPaydaySchedule } from "./schedule"
import { money } from "./document"

/** Catalog recipe before it receives a stable budget-local id. */
export type CatalogPlanTemplate = Omit<PlanTemplate, "id"> & {
  /** Stable catalog key used as the budget template id when seeding */
  catalogKey: string
}

function payday(timezone = "Asia/Manila"): Schedule {
  return createPaydaySchedule({ timezone })
}

/**
 * Built-in catalog recipes. Kernel kinds only — labels differentiate
 * installment vs open-ended repayment, etc.
 */
export const CATALOG_PLAN_TEMPLATES: CatalogPlanTemplate[] = [
  {
    catalogKey: "catalog:salary-semi-monthly",
    name: "Salary (semi-monthly)",
    description: "Typical payday on the 15th and end of month.",
    kind: "income",
    defaultAmountOrFormula: {
      type: "fixed",
      money: money(50_000_00, "PHP"),
    },
    defaultSchedule: payday(),
    labels: ["salary", "payday"],
  },
  {
    catalogKey: "catalog:allocation-percent",
    name: "Percent allocation",
    description: "Allocate a percentage of actual income (base from Entry).",
    kind: "allocation",
    defaultAmountOrFormula: {
      type: "percent",
      percentBps: 1000, // 10%
    },
    defaultSchedule: payday(),
    labels: ["allocation", "percent"],
  },
  {
    catalogKey: "catalog:subscription-monthly",
    name: "Monthly subscription",
    description: "Recurring service charge on payday cadence.",
    kind: "subscription",
    defaultAmountOrFormula: {
      type: "fixed",
      money: money(499_00, "PHP"),
    },
    defaultSchedule: payday(),
    labels: ["subscription", "monthly"],
  },
  {
    catalogKey: "catalog:repayment-installment-24",
    name: "Installment purchase (24 mo)",
    description: "Fixed-term repayment — still kernel kind repayment.",
    kind: "repayment",
    defaultAmountOrFormula: {
      type: "fixed",
      money: money(2_000_00, "PHP"),
    },
    defaultSchedule: {
      ...payday(),
      occurrenceCount: 24,
    },
    labels: ["installment", "24-mo"],
  },
  {
    catalogKey: "catalog:repayment-owe-mom",
    name: "Debt to Mom",
    description: "Open-ended or remaining-balance repayment to a person.",
    kind: "repayment",
    defaultAmountOrFormula: {
      type: "remainingBalance",
      ofAccountId: "", // caller links the liability Account
    },
    defaultSchedule: payday(),
    labels: ["debt", "owe-mom"],
  },
]

export type SeedCatalogPlanTemplatesInput = {
  /** Only seed these catalog keys; default = all */
  catalogKeys?: string[]
  /** When false (default), skip keys already present on the budget */
  overwrite?: boolean
  /** Override schedule timezone on seeded templates */
  timezone?: string
}

/**
 * Copy catalog recipes into `planTemplatesById`.
 * Creating a Plan from a template still copies fields — this only seeds recipes.
 */
export function applySeedCatalogPlanTemplates(
  draft: BudgetDoc,
  input: SeedCatalogPlanTemplatesInput = {},
): { seededIds: string[]; skippedIds: string[] } {
  ensureBudgetDocShape(draft)
  const wanted = input.catalogKeys
    ? new Set(input.catalogKeys)
    : null
  const seededIds: string[] = []
  const skippedIds: string[] = []

  for (const recipe of CATALOG_PLAN_TEMPLATES) {
    if (wanted && !wanted.has(recipe.catalogKey)) continue

    if (!input.overwrite && draft.planTemplatesById[recipe.catalogKey]) {
      skippedIds.push(recipe.catalogKey)
      continue
    }

    let defaultSchedule = recipe.defaultSchedule
    if (defaultSchedule && input.timezone) {
      defaultSchedule = { ...defaultSchedule, timezone: input.timezone }
    }

    // remainingBalance with empty ofAccountId is a catalog hint — omit until linked
    let defaultAmountOrFormula = recipe.defaultAmountOrFormula
    if (
      defaultAmountOrFormula?.type === "remainingBalance" &&
      !defaultAmountOrFormula.ofAccountId
    ) {
      defaultAmountOrFormula = undefined
    }

    applyUpsertPlanTemplate(draft, {
      id: recipe.catalogKey,
      name: recipe.name,
      kind: recipe.kind,
      description: recipe.description ?? null,
      defaultAmountOrFormula: defaultAmountOrFormula ?? null,
      defaultSchedule: defaultSchedule ?? null,
      labels: recipe.labels ?? null,
    })
    seededIds.push(recipe.catalogKey)
  }

  return { seededIds, skippedIds }
}
