"use server"

import { revalidatePath } from "next/cache"

import { getCurrentUser } from "@/lib/session"

import {
  archiveBudgetCatalog,
  createBudgetWithOwner,
  listAccessibleBudgets,
  renameBudgetCatalog,
  requireBudgetAccess,
  type AccessibleBudget,
} from "./db/membership"

export type BudgetListItem = {
  id: string
  name: string
  automergeUrl: string
  status: "active" | "archived"
  role: "owner" | "contributor"
  createdAt: string
  updatedAt: string
}

export type BudgetActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string }

function toListItem(row: AccessibleBudget): BudgetListItem {
  return {
    id: row.id,
    name: row.name,
    automergeUrl: row.automergeUrl,
    status: row.status,
    role: row.role,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

async function requireSignedInUser() {
  const user = await getCurrentUser()
  if (!user) {
    return null
  }
  return user
}

export async function createBudgetAction(input: {
  id: string
  name: string
  automergeUrl: string
}): Promise<BudgetActionResult<BudgetListItem>> {
  const user = await requireSignedInUser()
  if (!user) return { ok: false, error: "Sign in required" }

  try {
    const data = await createBudgetWithOwner({
      id: input.id,
      name: input.name,
      automergeUrl: input.automergeUrl,
      createdByUserId: user.id,
    })
    revalidatePath("/")
    return { ok: true, data: toListItem(data) }
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to create budget",
    }
  }
}

export async function listBudgetsAction(options?: {
  includeArchived?: boolean
}): Promise<BudgetActionResult<BudgetListItem[]>> {
  const user = await requireSignedInUser()
  if (!user) return { ok: false, error: "Sign in required" }

  try {
    const data = await listAccessibleBudgets(user.id, options)
    return { ok: true, data: data.map(toListItem) }
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to list budgets",
    }
  }
}

export async function getBudgetAccessAction(
  budgetId: string,
): Promise<
  BudgetActionResult<{
    role: "owner" | "contributor"
    status: "active" | "archived"
    automergeUrl: string
    name: string
  }>
> {
  const user = await requireSignedInUser()
  if (!user) return { ok: false, error: "Sign in required" }

  try {
    const data = await requireBudgetAccess(budgetId, user.id)
    return { ok: true, data }
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Access denied",
    }
  }
}

export async function renameBudgetAction(input: {
  budgetId: string
  name: string
}): Promise<BudgetActionResult<{ name: string }>> {
  const user = await requireSignedInUser()
  if (!user) return { ok: false, error: "Sign in required" }

  try {
    await renameBudgetCatalog(input.budgetId, user.id, input.name)
    revalidatePath("/")
    revalidatePath(`/budgets/${input.budgetId}`)
    return { ok: true, data: { name: input.name.trim() } }
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to rename budget",
    }
  }
}

export async function archiveBudgetAction(input: {
  budgetId: string
}): Promise<BudgetActionResult<{ budgetId: string }>> {
  const user = await requireSignedInUser()
  if (!user) return { ok: false, error: "Sign in required" }

  try {
    await archiveBudgetCatalog(input.budgetId, user.id)
    revalidatePath("/")
    revalidatePath(`/budgets/${input.budgetId}`)
    return { ok: true, data: { budgetId: input.budgetId } }
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to archive budget",
    }
  }
}
