/** Pure invite helpers — unit-tested without a database. */

export const INVITE_TTL_MS = 1000 * 60 * 60 * 24 * 7 // 7 days

export function normalizeInviteEmail(email: string): string {
  return email.trim().toLowerCase()
}

export function isValidInviteEmail(email: string): boolean {
  const normalized = normalizeInviteEmail(email)
  // Practical check — not full RFC. Requires local@domain with a dot in domain.
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)
}

export function inviteExpiresAt(from: Date = new Date()): Date {
  return new Date(from.getTime() + INVITE_TTL_MS)
}

export function isInviteExpired(
  expiresAt: Date,
  now: Date = new Date(),
): boolean {
  return expiresAt.getTime() <= now.getTime()
}

export function emailsMatch(a: string, b: string): boolean {
  return normalizeInviteEmail(a) === normalizeInviteEmail(b)
}

export function newInviteToken(): string {
  return crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "")
}
