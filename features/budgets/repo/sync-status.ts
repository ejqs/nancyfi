export type SyncPhase = "offline" | "online" | "syncing"

export function deriveSyncPhase(input: {
  online: boolean
  syncConfigured: boolean
  peerCount: number
}): SyncPhase {
  if (!input.online) return "offline"
  if (input.syncConfigured && input.peerCount === 0) return "syncing"
  return "online"
}
