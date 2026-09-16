/** Format integer minor units as major.minor with currency. */
export function formatMinor(
  amountMinor: number,
  currency: string,
): string {
  const sign = amountMinor < 0 ? "-" : ""
  const abs = Math.abs(amountMinor)
  const major = Math.floor(abs / 100)
  const cents = String(abs % 100).padStart(2, "0")
  return `${sign}${major}.${cents} ${currency}`
}

export function parseMajorToMinor(raw: string): number {
  const trimmed = raw.trim()
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) {
    throw new Error("Amount must be a positive number with up to 2 decimals")
  }
  const [whole, frac = ""] = trimmed.split(".")
  const minor = Number(whole) * 100 + Number((frac + "00").slice(0, 2))
  if (!Number.isInteger(minor) || minor <= 0) {
    throw new Error("Amount must be greater than zero")
  }
  return minor
}
