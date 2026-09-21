/**
 * Nested spreadsheet row models (Catalog + Debts).
 * Importable without Next.js or React — hosts render with TanStack Table.
 */

import {
  accountRollupBalanceMinor,
  entryAmountMinor,
  isPurchaseEntry,
  listChildAccounts,
  listChildEntries,
  listRootAccounts,
  purchaseRemainingMinor,
} from "./entry-tree"
import { formatMinor } from "./money-format"
import type { Account, BudgetDoc, Entry } from "./types"

export type NestedSheetKind = "catalog" | "debts"

export type NestedSheetRow = {
  id: string
  title: string
  amountLabel: string
  remainingLabel?: string
  statusLabel: string
  statusTone: "proposed" | "posted" | "void" | "active" | "muted"
  meta: string
  children: NestedSheetRow[]
  entryId?: string
  accountId?: string
}

export type NestedSheet = {
  kind: NestedSheetKind
  title: string
  description: string
  rows: NestedSheetRow[]
  summaryLabel: string
  emptyLabel: string
}

function accountRow(doc: BudgetDoc, account: Account): NestedSheetRow {
  const currency = doc.defaultCurrency
  const children = listChildAccounts(doc, account.id)
    .filter((child) => child.status === "active")
    .map((child) => accountRow(doc, child))
  const balance = accountRollupBalanceMinor(doc, account.id, currency)
  return {
    id: `account:${account.id}`,
    title: account.name,
    amountLabel: formatMinor(balance, currency),
    statusLabel: account.kind,
    statusTone: "active",
    meta: children.length > 0 ? `${children.length} nested` : account.kind,
    children,
    accountId: account.id,
  }
}

export function buildCatalogSheet(doc: BudgetDoc): NestedSheet {
  const rows = listRootAccounts(doc).map((account) => accountRow(doc, account))
  return {
    kind: "catalog",
    title: "Catalog",
    description:
      "Account folders (Online Services → Brain). Nest with Account.parentId — not a Headphones Account.",
    rows,
    summaryLabel:
      rows.length === 0
        ? "No accounts yet"
        : `${rows.length} top-level ${rows.length === 1 ? "account" : "accounts"}`,
    emptyLabel:
      "Add bank, Mom, and folders in Settings. Nest categories with a parent account.",
  }
}

function entryStatus(entry: Entry): NestedSheetRow["statusTone"] {
  if (entry.status === "proposed") return "proposed"
  if (entry.status === "void") return "void"
  return "posted"
}

function repaymentRow(entry: Entry): NestedSheetRow {
  const amount = entryAmountMinor(entry)
  const currency = entry.postings[0]?.money.currency ?? ""
  return {
    id: entry.id,
    title: entry.description,
    amountLabel: currency ? formatMinor(amount, currency) : "—",
    statusLabel:
      entry.status === "proposed"
        ? "needs review"
        : entry.status === "posted"
          ? "posted"
          : "void",
    statusTone: entryStatus(entry),
    meta: entry.effectiveAt.slice(0, 10),
    children: [],
    entryId: entry.id,
  }
}

function purchaseRow(doc: BudgetDoc, purchase: Entry): NestedSheetRow {
  const currency = doc.defaultCurrency
  const children = listChildEntries(doc, purchase.id)
    .filter((entry) => entry.status !== "void")
    .map(repaymentRow)
  const remaining = purchaseRemainingMinor(doc, purchase.id)
  return {
    id: purchase.id,
    title: purchase.description,
    amountLabel: formatMinor(entryAmountMinor(purchase), currency),
    remainingLabel: formatMinor(remaining, currency),
    statusLabel: children.length > 0 ? `${children.length} nested` : "purchase",
    statusTone: entryStatus(purchase),
    meta: purchase.effectiveAt.slice(0, 10),
    children,
    entryId: purchase.id,
  }
}

export function buildDebtsSheet(doc: BudgetDoc): NestedSheet {
  const purchases = Object.values(doc.entriesById ?? {})
    .filter((entry) => isPurchaseEntry(doc, entry))
    .sort(comparePurchases)
  const remaining = purchases.reduce(
    (sum, purchase) => sum + purchaseRemainingMinor(doc, purchase.id),
    0,
  )
  return {
    kind: "debts",
    title: "Debts",
    description:
      "Purchase Entry → nested repayment Entries. Remaining is derived. Headphones-this-buy is not an Account.",
    rows: purchases.map((purchase) => purchaseRow(doc, purchase)),
    summaryLabel: `Remaining ${formatMinor(remaining, doc.defaultCurrency)}`,
    emptyLabel:
      "Add a purchase Entry. Nested repayments reduce remaining. Do not invent a Headphones Account.",
  }
}

function comparePurchases(a: Entry, b: Entry): number {
  if (a.effectiveAt !== b.effectiveAt) {
    return b.effectiveAt.localeCompare(a.effectiveAt)
  }
  return a.description.localeCompare(b.description)
}
