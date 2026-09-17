/**
 * Pure helpers for resetting a user's Nancyfi workspace back to 0 budgets.
 * Control-plane execution lives in `db/membership.ts`.
 *
 * @see https://linear.app/nancyfi/issue/NAN-35/reset-user-account-back-to-empty-0-budgets
 */

import type { BudgetMembershipRole, BudgetStatus } from "./db/schema"

export const USER_ACCOUNT_RESET_CONFIRMATION = "RESET"

export type UserMembershipSnapshot = {
  budgetId: string
  role: BudgetMembershipRole
  /** Number of owners currently on this budget (including this user). */
  ownerCount: number
  budgetStatus: BudgetStatus
}

export type UserAccountResetPlanItem =
  | { budgetId: string; action: "archive-and-leave" }
  | { budgetId: string; action: "leave" }

/**
 * Decide how each membership is cleared so the user ends with no budget access.
 * Last owner → archive then leave. Everyone else → leave only.
 */
export function planUserAccountReset(
  memberships: UserMembershipSnapshot[],
): UserAccountResetPlanItem[] {
  return memberships.map((membership) => {
    if (membership.role === "owner" && membership.ownerCount <= 1) {
      return { budgetId: membership.budgetId, action: "archive-and-leave" }
    }
    return { budgetId: membership.budgetId, action: "leave" }
  })
}

export function isValidUserAccountResetConfirmation(value: string): boolean {
  return value.trim() === USER_ACCOUNT_RESET_CONFIRMATION
}
