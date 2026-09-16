import { SYNC_SERVER_PEER_ID } from "./sync-constants"

export type SyncPhase = "offline" | "online" | "syncing"

export function deriveSyncPhase(input: {
  online: boolean
  syncConfigured: boolean
  /** Count of all Repo peers (BroadcastChannel tabs + sync server). */
  peerCount: number
  /** True when `nancyfi-sync-server` is connected (cross-device sync). */
  syncServerConnected: boolean
}): SyncPhase {
  if (!input.online) return "offline"
  if (!input.syncConfigured) return "online"
  // BroadcastChannel peers alone must not count as "Synced" for cross-device.
  if (!input.syncServerConnected) return "syncing"
  return "online"
}

export function isSyncServerPeer(peerId: string): boolean {
  return peerId === SYNC_SERVER_PEER_ID
}
