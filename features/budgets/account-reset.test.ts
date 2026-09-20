import { describe, expect, test } from "bun:test"

import {
  isValidUserAccountResetConfirmation,
  planUserAccountReset,
  USER_ACCOUNT_RESET_CONFIRMATION,
} from "./account-reset"

describe("user account reset plan", () => {
  test("hard-deletes sole-owned budgets and leaves everything else", () => {
    const plan = planUserAccountReset([
      {
        budgetId: "solo",
        role: "owner",
        ownerCount: 1,
        budgetStatus: "active",
      },
      {
        budgetId: "shared-owner",
        role: "owner",
        ownerCount: 2,
        budgetStatus: "active",
      },
      {
        budgetId: "contrib",
        role: "contributor",
        ownerCount: 1,
        budgetStatus: "active",
      },
      {
        budgetId: "archived-solo",
        role: "owner",
        ownerCount: 1,
        budgetStatus: "archived",
      },
    ])

    expect(plan).toEqual([
      { budgetId: "solo", action: "delete-budget" },
      { budgetId: "shared-owner", action: "leave" },
      { budgetId: "contrib", action: "leave" },
      { budgetId: "archived-solo", action: "delete-budget" },
    ])
  })

  test("empty memberships produce an empty plan", () => {
    expect(planUserAccountReset([])).toEqual([])
  })

  test("confirmation must be exact RESET", () => {
    expect(USER_ACCOUNT_RESET_CONFIRMATION).toBe("RESET")
    expect(isValidUserAccountResetConfirmation("RESET")).toBe(true)
    expect(isValidUserAccountResetConfirmation(" reset ")).toBe(false)
    expect(isValidUserAccountResetConfirmation("reset")).toBe(false)
    expect(isValidUserAccountResetConfirmation("")).toBe(false)
  })
})
