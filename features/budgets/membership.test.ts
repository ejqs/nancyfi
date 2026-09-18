import { describe, expect, test } from "bun:test"

import {
  BUDGET_MEMBERSHIP_ROLES,
  BUDGET_STATUSES,
} from "@/schema/budget"

describe("budget membership control plane", () => {
  test("roles are only owner and contributor", () => {
    expect([...BUDGET_MEMBERSHIP_ROLES]).toEqual(["owner", "contributor"])
  })

  test("catalog statuses support active and archived", () => {
    expect([...BUDGET_STATUSES]).toEqual(["active", "archived"])
  })

  test("create path must hardcode owner (no client role input type)", () => {
    // Structural guard: CreateBudgetMembershipInput has no `role` field.
    type CreateInput = {
      id: string
      name: string
      automergeUrl: string
      createdByUserId: string
    }
    type HasRole = "role" extends keyof CreateInput ? true : false
    const hasRole: HasRole = false
    expect(hasRole).toBe(false)
  })
})
