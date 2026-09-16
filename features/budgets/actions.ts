"use server"

import { revalidatePath } from "next/cache"

import { getCurrentUser } from "@/lib/session"

import {
  isValidUserAccountResetConfirmation,
} from "./account-reset"
import {
  acceptBudgetInvite,
  cancelBudgetInvite,
  createBudgetInvite,
  getInviteByToken,
  leaveBudget,
  listBudgetMembers,
  listPendingInvites,
  revokeBudgetMembership,
} from "./db/invites"
import {
  archiveBudgetCatalog,
  createBudgetWithOwner,
  listAccessibleBudgets,
  renameBudgetCatalog,
  requireBudgetAccess,
  resetUserAccountData,
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

export type ResetUserAccountActionResult = {
  archivedBudgetIds: string[]
  leftBudgetIds: string[]
  cancelledInviteCount: number
}

/**
 * Reset the signed-in user’s workspace to 0 budgets (keeps login).
 * Requires typed confirmation `RESET` from the client.
 */
export async function resetUserAccountAction(input: {
  confirmation: string
}): Promise<BudgetActionResult<ResetUserAccountActionResult>> {
  const user = await requireSignedInUser()
  if (!user) return { ok: false, error: "Sign in required" }

  if (!isValidUserAccountResetConfirmation(input.confirmation)) {
    return {
      ok: false,
      error: "Type RESET to confirm resetting your account",
    }
  }

  try {
    const data = await resetUserAccountData({
      userId: user.id,
      email: user.email,
    })
    revalidatePath("/")
    return { ok: true, data }
  } catch (err) {
    return {
      ok: false,
      error:
        err instanceof Error ? err.message : "Failed to reset your account",
    }
  }
}

export type BudgetMemberItem = {
  membershipId: string
  userId: string
  email: string
  name: string
  role: "owner" | "contributor"
  createdAt: string
}

export type BudgetInviteItem = {
  id: string
  email: string
  status: "pending" | "accepted" | "cancelled" | "expired"
  expiresAt: string
  createdAt: string
  acceptUrl: string
}

export async function listBudgetMembersAction(
  budgetId: string,
): Promise<BudgetActionResult<BudgetMemberItem[]>> {
  const user = await requireSignedInUser()
  if (!user) return { ok: false, error: "Sign in required" }

  try {
    const data = await listBudgetMembers(budgetId, user.id)
    return {
      ok: true,
      data: data.map((row) => ({
        membershipId: row.membershipId,
        userId: row.userId,
        email: row.email,
        name: row.name,
        role: row.role,
        createdAt: row.createdAt.toISOString(),
      })),
    }
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to list members",
    }
  }
}

export async function listPendingInvitesAction(
  budgetId: string,
): Promise<BudgetActionResult<BudgetInviteItem[]>> {
  const user = await requireSignedInUser()
  if (!user) return { ok: false, error: "Sign in required" }

  try {
    const origin =
      process.env.BETTER_AUTH_URL?.replace(/\/$/, "") ?? "http://localhost:3000"
    const data = await listPendingInvites(budgetId, user.id)
    return {
      ok: true,
      data: data.map((row) => ({
        id: row.id,
        email: row.email,
        status: row.status,
        expiresAt: row.expiresAt.toISOString(),
        createdAt: row.createdAt.toISOString(),
        acceptUrl: `${origin}/invites/${row.token}`,
      })),
    }
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to list invites",
    }
  }
}

export async function createBudgetInviteAction(input: {
  budgetId: string
  email: string
}): Promise<
  BudgetActionResult<{
    id: string
    email: string
    acceptUrl: string
    emailSent: boolean
    emailError?: string
  }>
> {
  const user = await requireSignedInUser()
  if (!user) return { ok: false, error: "Sign in required" }

  try {
    const data = await createBudgetInvite({
      budgetId: input.budgetId,
      email: input.email,
      invitedByUserId: user.id,
    })
    revalidatePath(`/budgets/${input.budgetId}`)
    return {
      ok: true,
      data: {
        id: data.id,
        email: data.email,
        acceptUrl: data.acceptUrl,
        emailSent: data.emailSent,
        emailError: data.emailError,
      },
    }
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to create invite",
    }
  }
}

export async function cancelBudgetInviteAction(input: {
  inviteId: string
  budgetId: string
}): Promise<BudgetActionResult<{ inviteId: string }>> {
  const user = await requireSignedInUser()
  if (!user) return { ok: false, error: "Sign in required" }

  try {
    await cancelBudgetInvite({
      inviteId: input.inviteId,
      actorUserId: user.id,
    })
    revalidatePath(`/budgets/${input.budgetId}`)
    return { ok: true, data: { inviteId: input.inviteId } }
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to cancel invite",
    }
  }
}

export async function revokeBudgetMemberAction(input: {
  budgetId: string
  targetUserId: string
}): Promise<BudgetActionResult<{ targetUserId: string }>> {
  const user = await requireSignedInUser()
  if (!user) return { ok: false, error: "Sign in required" }

  try {
    await revokeBudgetMembership({
      budgetId: input.budgetId,
      targetUserId: input.targetUserId,
      actorUserId: user.id,
    })
    revalidatePath(`/budgets/${input.budgetId}`)
    return { ok: true, data: { targetUserId: input.targetUserId } }
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to revoke member",
    }
  }
}

export async function leaveBudgetAction(input: {
  budgetId: string
}): Promise<BudgetActionResult<{ budgetId: string }>> {
  const user = await requireSignedInUser()
  if (!user) return { ok: false, error: "Sign in required" }

  try {
    await leaveBudget({ budgetId: input.budgetId, userId: user.id })
    revalidatePath("/")
    revalidatePath(`/budgets/${input.budgetId}`)
    return { ok: true, data: { budgetId: input.budgetId } }
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to leave budget",
    }
  }
}

export async function getInvitePreviewAction(
  token: string,
): Promise<
  BudgetActionResult<{
    budgetName: string
    email: string
    status: "pending" | "accepted" | "cancelled" | "expired"
    expiresAt: string
  }>
> {
  try {
    const invite = await getInviteByToken(token)
    if (!invite) {
      return { ok: false, error: "Invitation not found" }
    }
    return {
      ok: true,
      data: {
        budgetName: invite.budgetName,
        email: invite.email,
        status: invite.status,
        expiresAt: invite.expiresAt.toISOString(),
      },
    }
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to load invitation",
    }
  }
}

export async function acceptBudgetInviteAction(input: {
  token: string
}): Promise<BudgetActionResult<{ budgetId: string }>> {
  const user = await requireSignedInUser()
  if (!user) return { ok: false, error: "Sign in required" }

  try {
    const data = await acceptBudgetInvite({
      token: input.token,
      userId: user.id,
      userEmail: user.email,
    })
    revalidatePath("/")
    revalidatePath(`/budgets/${data.budgetId}`)
    return { ok: true, data: { budgetId: data.budgetId } }
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to accept invitation",
    }
  }
}
