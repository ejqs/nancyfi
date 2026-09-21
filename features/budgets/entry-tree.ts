/**
 * Entry nesting helpers. Parent pointers live on `Entry.parentId`;
 * children are always derived (never a persisted `children[]`).
 *
 * Plan expansion is separate: generated Entries are found via
 * `sourcePlanOccurrenceId` prefix, not `parentId`.
 */

import type { BudgetDoc, Entry, Plan } from "./types"

export function paydayParentEntryId(date: string): string {
  return `payday:${date}:parent`
}

export function paydayDateFromParentId(entryId: string): string | null {
  const match = /^payday:(\d{4}-\d{2}-\d{2}):parent$/.exec(entryId)
  return match?.[1] ?? null
}

export function isPaydayParentEntry(entry: Entry): boolean {
  return paydayDateFromParentId(entry.id) !== null
}

export function listChildEntries(doc: BudgetDoc, parentId: string): Entry[] {
  return Object.values(doc.entriesById ?? {})
    .filter((entry) => entry.parentId === parentId)
    .sort(compareEntries)
}

export function listRootEntries(doc: BudgetDoc): Entry[] {
  return Object.values(doc.entriesById ?? {})
    .filter((entry) => !entry.parentId)
    .sort(compareEntries)
}

/** Generated Entries for a Plan (view-layer expansion, not parentId). */
export function listEntriesForPlan(doc: BudgetDoc, planId: string): Entry[] {
  const prefix = `${planId}:`
  return Object.values(doc.entriesById ?? {})
    .filter((entry) => entry.sourcePlanOccurrenceId?.startsWith(prefix))
    .sort(compareEntries)
}

export function entryAmountMinor(entry: Entry): number {
  let max = 0
  for (const posting of entry.postings) {
    const abs = Math.abs(posting.money.amountMinor)
    if (abs > max) max = abs
  }
  return max
}

export function compareEntries(a: Entry, b: Entry): number {
  if (a.effectiveAt !== b.effectiveAt) {
    return a.effectiveAt.localeCompare(b.effectiveAt)
  }
  return a.description.localeCompare(b.description)
}

export function planByOccurrencePrefix(
  doc: BudgetDoc,
  sourcePlanOccurrenceId: string | undefined,
): Plan | undefined {
  if (!sourcePlanOccurrenceId) return undefined
  const planId = sourcePlanOccurrenceId.split(":")[0]
  return planId ? doc.plansById[planId] : undefined
}
