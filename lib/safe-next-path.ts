/** Same-origin relative path only; blocks open redirects. */
export function safeNextPath(next: string | undefined | null): string {
  if (!next || !next.startsWith("/") || next.startsWith("//")) {
    return "/"
  }
  return next
}
