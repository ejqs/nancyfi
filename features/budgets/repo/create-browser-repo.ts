/**
 * Browser Automerge Repo for budget documents.
 *
 * Storage: IndexedDB (`@automerge/automerge-repo-storage-indexeddb`)
 * Network:
 *   - BroadcastChannel for same-origin tabs
 *   - Optional WebSocket client → Nancyfi sync server
 *     (`NEXT_PUBLIC_AUTOMERGE_SYNC_URL`, e.g. ws://127.0.0.1:3030)
 */
import { Repo, type NetworkAdapterInterface } from "@automerge/automerge-repo/slim"
import { BroadcastChannelNetworkAdapter } from "@automerge/automerge-repo-network-broadcastchannel"
import { WebSocketClientAdapter } from "@automerge/automerge-repo-network-websocket"
import { IndexedDBStorageAdapter } from "@automerge/automerge-repo-storage-indexeddb"

export const INDEXED_DB_NAME = "nancyfi-automerge"
const BROADCAST_CHANNEL = "nancyfi-automerge-sync"

let browserRepoSingleton: Repo | undefined

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

export function createBrowserRepo(): Repo {
  if (typeof window === "undefined") {
    throw new Error("createBrowserRepo() is browser-only")
  }

  const network: NetworkAdapterInterface[] = [
    new BroadcastChannelNetworkAdapter({
      channelName: BROADCAST_CHANNEL,
    }),
  ]

  const syncUrl = getAutomergeSyncUrl()
  if (syncUrl) {
    network.push(new WebSocketClientAdapter(syncUrl))
  }

  return new Repo({
    storage: new IndexedDBStorageAdapter(INDEXED_DB_NAME),
    network,
    // Always offer our docs to the sync server (and other tabs). The server
    // still uses announce:false so it does not flood every peer with every doc.
    sharePolicy: async () => true,
  })
}

/** Singleton for the current browser tab (survives React remounts / HMR). */
export function getOrCreateBrowserRepo(): Repo {
  if (typeof window === "undefined") {
    throw new Error("getOrCreateBrowserRepo() is browser-only")
  }
  if (!browserRepoSingleton) {
    browserRepoSingleton = createBrowserRepo()
  }
  return browserRepoSingleton
}

/** Drop the in-memory Repo so the next call opens a fresh store. */
export function clearBrowserRepoSingleton(): void {
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
