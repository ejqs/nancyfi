/**
 * Browser Automerge Repo for budget documents.
 *
 * Storage: IndexedDB (`@automerge/automerge-repo-storage-indexeddb`)
 *   Document store name: `nancyfi-automerge` — keep distinct from the reserved
 *   Keyhive store name in `keyhive-compat.ts` (`nancyfi-keyhive`).
 * Network:
 *   - BroadcastChannel for same-origin tabs
 *   - Optional WebSocket client → Nancyfi sync server
 *     (`NEXT_PUBLIC_AUTOMERGE_SYNC_URL`, e.g. ws://127.0.0.1:3030)
 *     Auth: short-lived membership JWT via `?token=` (NAN-33)
 */
import {
  Repo,
  type NetworkAdapterInterface,
  type PeerId,
} from "@automerge/automerge-repo/slim"
import { BroadcastChannelNetworkAdapter } from "@automerge/automerge-repo-network-broadcastchannel"
import { WebSocketClientAdapter } from "@automerge/automerge-repo-network-websocket"
import { IndexedDBStorageAdapter } from "@automerge/automerge-repo-storage-indexeddb"

import { syncUrlWithToken } from "./sync-token"

export const INDEXED_DB_NAME = "nancyfi-automerge"
const BROADCAST_CHANNEL = "nancyfi-automerge-sync"

let browserRepoSingleton: Repo | undefined
let browserSyncAdapter: WebSocketClientAdapter | undefined

export type BrowserRepoSyncAuth = {
  peerId: PeerId | string
  token: string
}

/** Public sync URL from Next env, or null when unset / empty. */
export function getAutomergeSyncUrl(): string | null {
  const raw = process.env.NEXT_PUBLIC_AUTOMERGE_SYNC_URL?.trim()
  if (!raw) return null
  if (!raw.startsWith("ws://") && !raw.startsWith("wss://")) {
    console.warn(
      `[nancyfi] NEXT_PUBLIC_AUTOMERGE_SYNC_URL must be ws:// or wss:// (got ${raw})`,
    )
    return null
  }
  return raw
}

export function createBrowserRepo(syncAuth?: BrowserRepoSyncAuth): Repo {
  if (typeof window === "undefined") {
    throw new Error("createBrowserRepo() is browser-only")
  }

  const network: NetworkAdapterInterface[] = [
    new BroadcastChannelNetworkAdapter({
      channelName: BROADCAST_CHANNEL,
    }),
  ]

  const syncUrl = getAutomergeSyncUrl()
  let syncAdapter: WebSocketClientAdapter | undefined
  if (syncUrl) {
    if (!syncAuth?.token || !syncAuth.peerId) {
      throw new Error(
        "Automerge sync is configured but sync credentials are missing",
      )
    }
    syncAdapter = new WebSocketClientAdapter(
      syncUrlWithToken(syncUrl, syncAuth.token),
    )
    network.push(syncAdapter)
  }

  const repo = new Repo({
    peerId: syncAuth?.peerId ? (syncAuth.peerId as PeerId) : undefined,
    storage: new IndexedDBStorageAdapter(INDEXED_DB_NAME),
    network,
    // Always offer our docs to the sync server (and other tabs). The server
    // still uses announce:false + JWT allowlist so it does not flood peers.
    sharePolicy: async () => true,
  })

  browserRepoSingleton = repo
  browserSyncAdapter = syncAdapter
  return repo
}

/**
 * Swap the WebSocket adapter to a new JWT without recreating the Repo
 * (preserves DocHandles / React subscriptions).
 */
export function replaceBrowserSyncAuth(
  repo: Repo,
  token: string,
): void {
  const syncUrl = getAutomergeSyncUrl()
  if (!syncUrl) {
    throw new Error("Automerge sync URL is not configured")
  }

  if (browserSyncAdapter) {
    repo.networkSubsystem.removeNetworkAdapter(browserSyncAdapter)
    browserSyncAdapter.disconnect()
    browserSyncAdapter = undefined
  }

  const next = new WebSocketClientAdapter(syncUrlWithToken(syncUrl, token))
  repo.networkSubsystem.addNetworkAdapter(next)
  browserSyncAdapter = next
}

/**
 * Singleton for the current browser tab (survives React remounts / HMR).
 * When remote sync is configured, pass credentials from `getSyncTokenAction`.
 */
export function getOrCreateBrowserRepo(syncAuth?: BrowserRepoSyncAuth): Repo {
  if (typeof window === "undefined") {
    throw new Error("getOrCreateBrowserRepo() is browser-only")
  }
  if (!browserRepoSingleton) {
    browserRepoSingleton = createBrowserRepo(syncAuth)
  }
  return browserRepoSingleton
}

/** Drop the in-memory Repo so the next call opens a fresh store. */
export function clearBrowserRepoSingleton(): void {
  if (browserSyncAdapter) {
    browserSyncAdapter.disconnect()
    browserSyncAdapter = undefined
  }
  browserRepoSingleton = undefined
}

/**
 * Clear local Automerge IndexedDB after a workspace reset.
 * Call after control-plane reset succeeds; then reload the page.
 */
export function clearBrowserAutomergeStorage(): Promise<void> {
  if (typeof window === "undefined") {
    return Promise.resolve()
  }
  clearBrowserRepoSingleton()
  return new Promise((resolve, reject) => {
    const request = window.indexedDB.deleteDatabase(INDEXED_DB_NAME)
    request.onsuccess = () => resolve()
    request.onerror = () =>
      reject(request.error ?? new Error("Failed to clear local budget data"))
    request.onblocked = () => resolve()
  })
}
