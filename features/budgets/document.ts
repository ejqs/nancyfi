import * as Automerge from "@automerge/automerge/slim"

import { BUDGET_SCHEMA_V1_INIT_BYTES } from "./schema-init"
import {
  BUDGET_SCHEMA_VERSION,
  type BudgetDoc,
  type Money,
} from "./types"

export type CreateBudgetInput = {
  id: string
  name: string
  timezone?: string
  defaultCurrency?: string
}

/** Load the shared-ancestry empty schema (no budget identity yet). */
export function loadBudgetSchema(): Automerge.Doc<BudgetDoc> {
  return Automerge.load<BudgetDoc>(BUDGET_SCHEMA_V1_INIT_BYTES)
}

/**
 * Create a new budget document from the hard-coded schema init.
 * Every peer that creates via this path shares the same schema ancestry.
 */
export function createBudgetDoc(
  input: CreateBudgetInput,
): Automerge.Doc<BudgetDoc> {
  const empty = loadBudgetSchema()
  return Automerge.change(empty, (doc) => {
    doc.schemaVersion = BUDGET_SCHEMA_VERSION
    doc.id = input.id
    doc.name = input.name
    doc.timezone = input.timezone ?? "UTC"
    doc.defaultCurrency = input.defaultCurrency ?? "PHP"
  })
}

export function saveBudgetDoc(doc: Automerge.Doc<BudgetDoc>): Uint8Array {
  return Automerge.save(doc)
}

export function loadBudgetDoc(bytes: Uint8Array): Automerge.Doc<BudgetDoc> {
  return Automerge.load<BudgetDoc>(bytes)
}

/** Build Money using Automerge Int so amountMinor is never a float in the CRDT. */
export function money(amountMinor: number, currency: string): Money {
  if (!Number.isInteger(amountMinor)) {
    throw new Error("Money.amountMinor must be an integer (minor units)")
  }
  if (!currency || currency.length !== 3) {
    throw new Error("Money.currency must be a 3-letter ISO 4217 code")
  }
  return {
    amountMinor,
    currency: currency.toUpperCase(),
  }
}

/** Assign Money into an Automerge change proxy with an Int amountMinor. */
export function putMoney(
  target: { amountMinor: number; currency: string },
  value: Money,
): void {
  if (!Number.isInteger(value.amountMinor)) {
    throw new Error("Money.amountMinor must be an integer (minor units)")
  }
  target.amountMinor = new Automerge.Int(value.amountMinor) as unknown as number
  target.currency = value.currency.toUpperCase()
}
