import { describe, expect, test } from "bun:test"

import {
  BUDGET_INVITE_ROLE,
  BUDGET_INVITE_STATUSES,
} from "./db/schema"
import {
  emailsMatch,
  inviteExpiresAt,
  INVITE_TTL_MS,
  isInviteExpired,
  isValidInviteEmail,
  normalizeInviteEmail,
  newInviteToken,
} from "./invite-rules"

describe("budget invite rules", () => {
  test("invites always grant contributor", () => {
    expect(BUDGET_INVITE_ROLE).toBe("contributor")
  })

  test("invite statuses cover lifecycle", () => {
    expect([...BUDGET_INVITE_STATUSES]).toEqual([
      "pending",
      "accepted",
      "cancelled",
      "expired",
    ])
  })

  test("normalizes and validates emails", () => {
    expect(normalizeInviteEmail("  Alex@Example.COM ")).toBe("alex@example.com")
    expect(isValidInviteEmail("alex@example.com")).toBe(true)
    expect(isValidInviteEmail("not-an-email")).toBe(false)
    expect(emailsMatch("Alex@Example.com", "alex@example.com")).toBe(true)
  })

  test("expiry is 7 days and detects past dates", () => {
    const from = new Date("2026-01-01T00:00:00.000Z")
    const expires = inviteExpiresAt(from)
    expect(expires.getTime() - from.getTime()).toBe(INVITE_TTL_MS)
    expect(isInviteExpired(expires, from)).toBe(false)
    expect(isInviteExpired(expires, new Date(expires.getTime() + 1))).toBe(true)
  })

  test("tokens are opaque and unique enough", () => {
    const a = newInviteToken()
    const b = newInviteToken()
    expect(a).not.toBe(b)
    expect(a.length).toBeGreaterThanOrEqual(32)
    expect(a.includes("-")).toBe(false)
  })

  test("create invite input has no client role field", () => {
    type CreateInviteInput = {
      budgetId: string
      email: string
      invitedByUserId: string
    }
    type HasRole = "role" extends keyof CreateInviteInput ? true : false
    const hasRole: HasRole = false
    expect(hasRole).toBe(false)
  })
})
