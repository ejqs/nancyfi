import { and, desc, eq, ne, or } from "drizzle-orm"

import { db } from "@/lib/db"

import {
  planUserAccountReset,
  type UserMembershipSnapshot,
} from "../account-reset"
import { normalizeInviteEmail } from "../invite-rules"
import {
  budget,
  budgetInvite,
  budgetMembership,
  type BudgetMembershipRole,
  type BudgetStatus,
} from "@/schema/budget"

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

export type ResetUserAccountResult = {
  archivedBudgetIds: string[]
  leftBudgetIds: string[]
  cancelledInviteCount: number
}

/**
 * Wipe the user’s budget access so their workspace is empty (0 budgets).
 * Keeps the auth user. Last-owner budgets are archived first; memberships
 * and pending invites for this user are removed/cancelled.
 */
export async function resetUserAccountData(input: {
  userId: string
  email: string
}): Promise<ResetUserAccountResult> {
  if (!input.userId) throw new Error("User id is required")
  const email = normalizeInviteEmail(input.email)
  if (!email) throw new Error("User email is required")

  return db.transaction(async (tx) => {
    const membershipRows = await tx
      .select({
        budgetId: budgetMembership.budgetId,
        role: budgetMembership.role,
        budgetStatus: budget.status,
      })
      .from(budgetMembership)
      .innerJoin(budget, eq(budgetMembership.budgetId, budget.id))
      .where(eq(budgetMembership.userId, input.userId))

    const snapshots: UserMembershipSnapshot[] = []
    for (const row of membershipRows) {
      const owners = await tx
        .select({ id: budgetMembership.id })
        .from(budgetMembership)
        .where(
          and(
            eq(budgetMembership.budgetId, row.budgetId),
            eq(budgetMembership.role, "owner"),
          ),
        )
      snapshots.push({
        budgetId: row.budgetId,
        role: row.role,
        ownerCount: owners.length,
        budgetStatus: row.budgetStatus,
      })
    }

    const plan = planUserAccountReset(snapshots)
    const archivedBudgetIds: string[] = []
    const leftBudgetIds: string[] = []

    for (const item of plan) {
      if (item.action === "archive-and-leave") {
        await tx
          .update(budget)
          .set({ status: "archived" })
          .where(eq(budget.id, item.budgetId))
        archivedBudgetIds.push(item.budgetId)
      }
      await tx
        .delete(budgetMembership)
        .where(
          and(
            eq(budgetMembership.budgetId, item.budgetId),
            eq(budgetMembership.userId, input.userId),
          ),
        )
      leftBudgetIds.push(item.budgetId)
    }

    const cancelled = await tx
      .update(budgetInvite)
      .set({ status: "cancelled" })
      .where(
        and(
          eq(budgetInvite.status, "pending"),
          or(
            eq(budgetInvite.invitedByUserId, input.userId),
            eq(budgetInvite.email, email),
          ),
        ),
      )
      .returning({ id: budgetInvite.id })

    return {
      archivedBudgetIds,
      leftBudgetIds,
      cancelledInviteCount: cancelled.length,
    }
  })
}
