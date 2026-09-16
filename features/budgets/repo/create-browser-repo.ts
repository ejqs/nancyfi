/**
 * Browser Automerge Repo for budget documents.
 *
 * Storage: IndexedDB (`@automerge/automerge-repo-storage-indexeddb`)
 * Network (v1 stub): BroadcastChannel for same-origin tabs.
 * Future remote sync: WebSocket adapter → Nancyfi sync server
 *   (`@automerge/automerge-repo-network-websocket`).
 */
import { Repo } from "@automerge/automerge-repo/slim"
import { BroadcastChannelNetworkAdapter } from "@automerge/automerge-repo-network-broadcastchannel"
import { IndexedDBStorageAdapter } from "@automerge/automerge-repo-storage-indexeddb"

const INDEXED_DB_NAME = "nancyfi-automerge"
const BROADCAST_CHANNEL = "nancyfi-automerge-sync"

let browserRepoSingleton: Repo | undefined

export function createBrowserRepo(): Repo {
  if (typeof window === "undefined") {
    throw new Error("createBrowserRepo() is browser-only")
  }

  return new Repo({
    storage: new IndexedDBStorageAdapter(INDEXED_DB_NAME),
    network: [
      new BroadcastChannelNetworkAdapter({
        channelName: BROADCAST_CHANNEL,
      }),
    ],
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
