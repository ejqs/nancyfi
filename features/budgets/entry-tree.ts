/**
 * Entry and Account nesting helpers.
 * Parent pointers live on `parentId`; children are always derived
 * (never a persisted `children[]`).
 */

import { accountPostedBalanceMinor } from "./plan-propose"
import type { Account, BudgetDoc, Entry } from "./types"

export function compareEntries(a: Entry, b: Entry): number {
  if (a.effectiveAt !== b.effectiveAt) {
    return a.effectiveAt.localeCompare(b.effectiveAt)
  }
  return a.description.localeCompare(b.description)
}

export function listChildEntries(doc: BudgetDoc, parentId: string): Entry[] {
  return Object.values(doc.entriesById ?? {})
    .filter((entry) => entry.parentId === parentId)
    .sort(compareEntries)
}

export function listChildAccounts(doc: BudgetDoc, parentId: string): Account[] {
  return Object.values(doc.accountsById ?? {})
    .filter((account) => account.parentId === parentId)
    .sort((a, b) => a.name.localeCompare(b.name))
}

export function listRootAccounts(doc: BudgetDoc): Account[] {
  return Object.values(doc.accountsById ?? {})
    .filter((account) => account.status === "active" && !account.parentId)
    .sort((a, b) => {
      if (a.kind !== b.kind) return a.kind.localeCompare(b.kind)
      return a.name.localeCompare(b.name)
    })
}

/** Transfer amount on an Entry (max abs posting). */
export function entryAmountMinor(entry: Entry): number {
  let max = 0
  for (const posting of entry.postings) {
    const abs = Math.abs(posting.money.amountMinor)
    if (abs > max) max = abs
  }
  return max
}

/**
 * Remaining on a purchase Entry: debit − nested **posted** credits.
 * Proposed children do not reduce remaining. Not an Account balance.
 */
export function purchaseRemainingMinor(
  doc: BudgetDoc,
  purchaseId: string,
): number {
  const purchase = doc.entriesById[purchaseId]
  if (!purchase) return 0
  const debit = entryAmountMinor(purchase)
  let postedCredits = 0
  for (const child of listChildEntries(doc, purchaseId)) {
    if (child.status !== "posted") continue
    postedCredits += entryAmountMinor(child)
  }
  return debit - postedCredits
}

export function isPurchaseEntry(doc: BudgetDoc, entry: Entry): boolean {
  if (entry.parentId) return false
  if (entry.status === "void") return false
  if (listChildEntries(doc, entry.id).length > 0) return true
  return entry.postings.some((posting) => posting.role === "principal")
}

/** Folder rollup: own posted balance plus descendant accounts. */
export function accountRollupBalanceMinor(
  doc: BudgetDoc,
  accountId: string,
  currency: string,
  seen = new Set<string>(),
): number {
  if (seen.has(accountId)) return 0
  seen.add(accountId)
  let sum = accountPostedBalanceMinor(doc, accountId, currency)
  for (const child of listChildAccounts(doc, accountId)) {
    if (child.status !== "active") continue
    sum += accountRollupBalanceMinor(doc, child.id, currency, seen)
  }
  return sum
}
