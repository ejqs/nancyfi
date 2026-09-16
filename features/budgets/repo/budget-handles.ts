import type { AutomergeUrl, DocHandle, Repo } from "@automerge/automerge-repo/slim"

import {
  createBudgetDoc,
  saveBudgetDoc,
  type CreateBudgetInput,
} from "../document"
import type { BudgetDoc } from "../types"

/** localStorage key for the probe / first local budget Automerge URL. */
export const LOCAL_BUDGET_URL_KEY = "nancyfi.localBudgetUrl"

/**
 * Create a budget in the Repo from shared-ancestry schema bytes.
 * Persists via the Repo storage adapter and announces on the network adapters.
 */
export function createBudgetInRepo(
  repo: Repo,
  input: CreateBudgetInput,
): DocHandle<BudgetDoc> {
  const binary = saveBudgetDoc(createBudgetDoc(input))
  return repo.import<BudgetDoc>(binary)
}

export async function findBudgetInRepo(
  repo: Repo,
  url: AutomergeUrl | string,
): Promise<DocHandle<BudgetDoc>> {
  return repo.find<BudgetDoc>(url as AutomergeUrl)
}

export function readStoredBudgetUrl(): AutomergeUrl | null {
  if (typeof window === "undefined") return null
  const value = window.localStorage.getItem(LOCAL_BUDGET_URL_KEY)
  return value ? (value as AutomergeUrl) : null
}

export function storeBudgetUrl(url: AutomergeUrl | string): void {
  window.localStorage.setItem(LOCAL_BUDGET_URL_KEY, url)
}
