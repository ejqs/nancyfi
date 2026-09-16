import { and, desc, eq, ne } from "drizzle-orm"

import { db } from "@/lib/db"

import {
  budget,
  budgetMembership,
  type BudgetMembershipRole,
  type BudgetStatus,
} from "./schema"

export type AccessibleBudget = {
  id: string
  name: string
  automergeUrl: string
  status: BudgetStatus
  role: BudgetMembershipRole
  createdAt: Date
  updatedAt: Date
}

export type CreateBudgetMembershipInput = {
  id: string
  name: string
  automergeUrl: string
  createdByUserId: string
}

function newId(): string {
  return crypto.randomUUID()
}

/**
 * Register a budget on the control plane and assign the creator as owner.
 * Role is hardcoded to `owner` — never accept role from the client/CRDT.
 */
export async function createBudgetWithOwner(
  input: CreateBudgetMembershipInput,
): Promise<AccessibleBudget> {
  const name = input.name.trim()
  if (!input.id) throw new Error("Budget id is required")
  if (!name) throw new Error("Budget name is required")
  if (!input.automergeUrl) throw new Error("Automerge URL is required")
  if (!input.createdByUserId) throw new Error("User id is required")

  await db.transaction(async (tx) => {
    await tx.insert(budget).values({
      id: input.id,
      name,
      automergeUrl: input.automergeUrl,
      status: "active",
      createdByUserId: input.createdByUserId,
    })
    await tx.insert(budgetMembership).values({
      id: newId(),
      budgetId: input.id,
      userId: input.createdByUserId,
      role: "owner",
    })
  })

  const [row] = await db
    .select({
      id: budget.id,
      name: budget.name,
      automergeUrl: budget.automergeUrl,
      status: budget.status,
      createdAt: budget.createdAt,
      updatedAt: budget.updatedAt,
    })
    .from(budget)
    .where(eq(budget.id, input.id))
    .limit(1)

  if (!row) throw new Error("Budget was not created")

  return {
    ...row,
    role: "owner" as const,
  }
}

/** Budgets the user can access via membership (control plane). */
export async function listAccessibleBudgets(
  userId: string,
  options?: { includeArchived?: boolean },
): Promise<AccessibleBudget[]> {
  const rows = await db
    .select({
      id: budget.id,
      name: budget.name,
      automergeUrl: budget.automergeUrl,
      status: budget.status,
      role: budgetMembership.role,
      createdAt: budget.createdAt,
      updatedAt: budget.updatedAt,
    })
    .from(budgetMembership)
    .innerJoin(budget, eq(budgetMembership.budgetId, budget.id))
    .where(
      options?.includeArchived
        ? eq(budgetMembership.userId, userId)
        : and(
            eq(budgetMembership.userId, userId),
            ne(budget.status, "archived"),
          ),
    )
    .orderBy(desc(budget.updatedAt))

  return rows
}

export async function getMembershipForUser(
  budgetId: string,
  userId: string,
): Promise<{ role: BudgetMembershipRole; status: BudgetStatus; automergeUrl: string; name: string } | null> {
  const [row] = await db
    .select({
      role: budgetMembership.role,
      status: budget.status,
      automergeUrl: budget.automergeUrl,
      name: budget.name,
    })
    .from(budgetMembership)
    .innerJoin(budget, eq(budgetMembership.budgetId, budget.id))
    .where(
      and(
        eq(budgetMembership.budgetId, budgetId),
        eq(budgetMembership.userId, userId),
      ),
    )
    .limit(1)

  return row ?? null
}

/** Require membership; does not elevate roles from CRDT or client claims. */
export async function requireBudgetAccess(
  budgetId: string,
  userId: string,
  options?: { roles?: BudgetMembershipRole[] },
) {
  const membership = await getMembershipForUser(budgetId, userId)
  if (!membership) {
    throw new Error("Budget not found or access denied")
  }
  if (options?.roles && !options.roles.includes(membership.role)) {
    throw new Error("Insufficient budget role")
  }
  return membership
}

export async function renameBudgetCatalog(
  budgetId: string,
  userId: string,
  name: string,
): Promise<void> {
  const trimmed = name.trim()
  if (!trimmed) throw new Error("Budget name is required")
  await requireBudgetAccess(budgetId, userId)
  await db
    .update(budget)
    .set({ name: trimmed })
    .where(eq(budget.id, budgetId))
}

/** Soft-archive. Prefer over hard delete for CRDT-safe retention. */
export async function archiveBudgetCatalog(
  budgetId: string,
  userId: string,
): Promise<void> {
  await requireBudgetAccess(budgetId, userId, { roles: ["owner"] })
  await db
    .update(budget)
    .set({ status: "archived" })
    .where(eq(budget.id, budgetId))
}
