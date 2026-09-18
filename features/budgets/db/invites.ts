import { and, desc, eq } from "drizzle-orm"

import { user } from "@/schema/auth-schema"
import { db } from "@/lib/db"
import { sendEmail } from "@/lib/email"

import {
  emailsMatch,
  inviteExpiresAt,
  isInviteExpired,
  isValidInviteEmail,
  newInviteToken,
  normalizeInviteEmail,
} from "../invite-rules"
import { requireBudgetAccess } from "./membership"
import {
  budget,
  budgetInvite,
  budgetMembership,
  BUDGET_INVITE_ROLE,
  type BudgetInviteStatus,
} from "@/schema/budget"

function newId(): string {
  return crypto.randomUUID()
}

function appOrigin(): string {
  return (
    process.env.BETTER_AUTH_URL?.replace(/\/$/, "") ?? "http://localhost:3000"
  )
}

export type BudgetInviteRow = {
  id: string
  budgetId: string
  email: string
  token: string
  role: typeof BUDGET_INVITE_ROLE
  status: BudgetInviteStatus
  invitedByUserId: string
  expiresAt: Date
  createdAt: Date
  budgetName: string
}

export type CreatedInvite = BudgetInviteRow & {
  acceptUrl: string
  emailSent: boolean
  emailError?: string
}

export type BudgetMemberRow = {
  membershipId: string
  userId: string
  email: string
  name: string
  role: "owner" | "contributor"
  createdAt: Date
}

export async function listBudgetMembers(
  budgetId: string,
  actorUserId: string,
): Promise<BudgetMemberRow[]> {
  await requireBudgetAccess(budgetId, actorUserId)

  return db
    .select({
      membershipId: budgetMembership.id,
      userId: budgetMembership.userId,
      email: user.email,
      name: user.name,
      role: budgetMembership.role,
      createdAt: budgetMembership.createdAt,
    })
    .from(budgetMembership)
    .innerJoin(user, eq(budgetMembership.userId, user.id))
    .where(eq(budgetMembership.budgetId, budgetId))
    .orderBy(desc(budgetMembership.createdAt))
}

export async function listPendingInvites(
  budgetId: string,
  actorUserId: string,
): Promise<BudgetInviteRow[]> {
  await requireBudgetAccess(budgetId, actorUserId, { roles: ["owner"] })

  const rows = await db
    .select({
      id: budgetInvite.id,
      budgetId: budgetInvite.budgetId,
      email: budgetInvite.email,
      token: budgetInvite.token,
      role: budgetInvite.role,
      status: budgetInvite.status,
      invitedByUserId: budgetInvite.invitedByUserId,
      expiresAt: budgetInvite.expiresAt,
      createdAt: budgetInvite.createdAt,
      budgetName: budget.name,
    })
    .from(budgetInvite)
    .innerJoin(budget, eq(budgetInvite.budgetId, budget.id))
    .where(
      and(
        eq(budgetInvite.budgetId, budgetId),
        eq(budgetInvite.status, "pending"),
      ),
    )
    .orderBy(desc(budgetInvite.createdAt))

  const now = new Date()
  const live: BudgetInviteRow[] = []
  for (const row of rows) {
    if (isInviteExpired(row.expiresAt, now)) {
      await db
        .update(budgetInvite)
        .set({ status: "expired" })
        .where(eq(budgetInvite.id, row.id))
      continue
    }
    live.push(row)
  }
  return live
}

/**
 * Owner creates an email invite. Role is always contributor.
 * Re-invite cancels prior pending invites for the same email on this budget.
 */
export async function createBudgetInvite(input: {
  budgetId: string
  email: string
  invitedByUserId: string
}): Promise<CreatedInvite> {
  await requireBudgetAccess(input.budgetId, input.invitedByUserId, {
    roles: ["owner"],
  })

  if (!isValidInviteEmail(input.email)) {
    throw new Error("A valid email address is required")
  }
  const email = normalizeInviteEmail(input.email)

  const [actor] = await db
    .select({ email: user.email })
    .from(user)
    .where(eq(user.id, input.invitedByUserId))
    .limit(1)
  if (actor && emailsMatch(actor.email, email)) {
    throw new Error("You cannot invite yourself")
  }

  const members = await db
    .select({ email: user.email })
    .from(budgetMembership)
    .innerJoin(user, eq(budgetMembership.userId, user.id))
    .where(eq(budgetMembership.budgetId, input.budgetId))
  if (members.some((m) => emailsMatch(m.email, email))) {
    throw new Error("That person is already a member of this budget")
  }

  const [catalog] = await db
    .select({ name: budget.name, status: budget.status })
    .from(budget)
    .where(eq(budget.id, input.budgetId))
    .limit(1)
  if (!catalog || catalog.status === "archived") {
    throw new Error("Budget not found or archived")
  }

  await db
    .update(budgetInvite)
    .set({ status: "cancelled" })
    .where(
      and(
        eq(budgetInvite.budgetId, input.budgetId),
        eq(budgetInvite.email, email),
        eq(budgetInvite.status, "pending"),
      ),
    )

  const id = newId()
  const token = newInviteToken()
  const expiresAt = inviteExpiresAt()

  await db.insert(budgetInvite).values({
    id,
    budgetId: input.budgetId,
    email,
    token,
    role: BUDGET_INVITE_ROLE,
    status: "pending",
    invitedByUserId: input.invitedByUserId,
    expiresAt,
  })

  const acceptUrl = `${appOrigin()}/invites/${token}`
  let emailSent = false
  let emailError: string | undefined

  try {
    await sendEmail({
      to: email,
      subject: `You're invited to “${catalog.name}” on Nancyfi`,
      text: `${actor?.email ?? "Someone"} invited you to collaborate on “${catalog.name}”. Open this link while signed in with ${email}: ${acceptUrl}`,
      html: `<p>You've been invited to collaborate on <strong>${escapeHtml(catalog.name)}</strong> on Nancyfi.</p><p><a href="${acceptUrl}">Accept invitation</a></p><p>Sign in with <strong>${escapeHtml(email)}</strong> to accept. This link expires in 7 days.</p>`,
      idempotencyKey: `budget-invite/${id}`,
    })
    emailSent = true
  } catch (err) {
    emailError = err instanceof Error ? err.message : "Failed to send email"
  }

  return {
    id,
    budgetId: input.budgetId,
    email,
    token,
    role: BUDGET_INVITE_ROLE,
    status: "pending",
    invitedByUserId: input.invitedByUserId,
    expiresAt,
    createdAt: new Date(),
    budgetName: catalog.name,
    acceptUrl,
    emailSent,
    emailError,
  }
}

export async function getInviteByToken(
  token: string,
): Promise<BudgetInviteRow | null> {
  if (!token) return null

  const [row] = await db
    .select({
      id: budgetInvite.id,
      budgetId: budgetInvite.budgetId,
      email: budgetInvite.email,
      token: budgetInvite.token,
      role: budgetInvite.role,
      status: budgetInvite.status,
      invitedByUserId: budgetInvite.invitedByUserId,
      expiresAt: budgetInvite.expiresAt,
      createdAt: budgetInvite.createdAt,
      budgetName: budget.name,
    })
    .from(budgetInvite)
    .innerJoin(budget, eq(budgetInvite.budgetId, budget.id))
    .where(eq(budgetInvite.token, token))
    .limit(1)

  if (!row) return null

  if (row.status === "pending" && isInviteExpired(row.expiresAt)) {
    await db
      .update(budgetInvite)
      .set({ status: "expired" })
      .where(eq(budgetInvite.id, row.id))
    return { ...row, status: "expired" }
  }

  return row
}

/**
 * Accept an invite online. Caller must be signed in with the invited email.
 * Inserts contributor membership; role is never taken from the client.
 */
export async function acceptBudgetInvite(input: {
  token: string
  userId: string
  userEmail: string
}): Promise<{ budgetId: string; role: typeof BUDGET_INVITE_ROLE }> {
  const invite = await getInviteByToken(input.token)
  if (!invite) {
    throw new Error("Invitation not found")
  }
  if (invite.status === "accepted") {
    throw new Error("Invitation was already accepted")
  }
  if (invite.status === "cancelled") {
    throw new Error("Invitation was cancelled")
  }
  if (invite.status === "expired" || isInviteExpired(invite.expiresAt)) {
    throw new Error("Invitation has expired")
  }
  if (invite.status !== "pending") {
    throw new Error("Invitation is no longer valid")
  }
  if (!emailsMatch(invite.email, input.userEmail)) {
    throw new Error(
      `Sign in with ${invite.email} to accept this invitation`,
    )
  }

  const existing = await db
    .select({ id: budgetMembership.id })
    .from(budgetMembership)
    .where(
      and(
        eq(budgetMembership.budgetId, invite.budgetId),
        eq(budgetMembership.userId, input.userId),
      ),
    )
    .limit(1)

  await db.transaction(async (tx) => {
    if (existing.length === 0) {
      await tx.insert(budgetMembership).values({
        id: newId(),
        budgetId: invite.budgetId,
        userId: input.userId,
        role: BUDGET_INVITE_ROLE,
      })
    }
    await tx
      .update(budgetInvite)
      .set({
        status: "accepted",
        acceptedAt: new Date(),
        acceptedByUserId: input.userId,
      })
      .where(eq(budgetInvite.id, invite.id))
  })

  return { budgetId: invite.budgetId, role: BUDGET_INVITE_ROLE }
}

export async function cancelBudgetInvite(input: {
  inviteId: string
  actorUserId: string
}): Promise<void> {
  const [invite] = await db
    .select({
      id: budgetInvite.id,
      budgetId: budgetInvite.budgetId,
      status: budgetInvite.status,
    })
    .from(budgetInvite)
    .where(eq(budgetInvite.id, input.inviteId))
    .limit(1)

  if (!invite) {
    throw new Error("Invitation not found")
  }

  await requireBudgetAccess(invite.budgetId, input.actorUserId, {
    roles: ["owner"],
  })

  if (invite.status !== "pending") {
    throw new Error("Only pending invitations can be cancelled")
  }

  await db
    .update(budgetInvite)
    .set({ status: "cancelled" })
    .where(eq(budgetInvite.id, invite.id))
}

/**
 * Owner removes a contributor. Cannot revoke owners (including self).
 */
export async function revokeBudgetMembership(input: {
  budgetId: string
  targetUserId: string
  actorUserId: string
}): Promise<void> {
  await requireBudgetAccess(input.budgetId, input.actorUserId, {
    roles: ["owner"],
  })

  if (input.targetUserId === input.actorUserId) {
    throw new Error("Use leave budget to remove yourself")
  }

  const [target] = await db
    .select({
      id: budgetMembership.id,
      role: budgetMembership.role,
    })
    .from(budgetMembership)
    .where(
      and(
        eq(budgetMembership.budgetId, input.budgetId),
        eq(budgetMembership.userId, input.targetUserId),
      ),
    )
    .limit(1)

  if (!target) {
    throw new Error("Member not found")
  }
  if (target.role === "owner") {
    throw new Error("Cannot revoke an owner")
  }

  await db.delete(budgetMembership).where(eq(budgetMembership.id, target.id))
}

/**
 * Member leaves a budget. Last owner cannot leave — archive instead.
 */
export async function leaveBudget(input: {
  budgetId: string
  userId: string
}): Promise<void> {
  const membership = await requireBudgetAccess(input.budgetId, input.userId)

  if (membership.role === "owner") {
    const owners = await db
      .select({ id: budgetMembership.id })
      .from(budgetMembership)
      .where(
        and(
          eq(budgetMembership.budgetId, input.budgetId),
          eq(budgetMembership.role, "owner"),
        ),
      )
    if (owners.length <= 1) {
      throw new Error(
        "You are the last owner. Archive the budget instead of leaving.",
      )
    }
  }

  await db
    .delete(budgetMembership)
    .where(
      and(
        eq(budgetMembership.budgetId, input.budgetId),
        eq(budgetMembership.userId, input.userId),
      ),
    )
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
}
