import * as Automerge from "@automerge/automerge/slim"
import type { AutomergeUrl, Repo } from "@automerge/automerge-repo/slim"

import { SYNC_SERVER_PEER_ID } from "./sync-constants"

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms)
  })
}

/** True when the Railway / local sync peer is in `repo.peers`. */
export function hasSyncServerPeer(repo: Repo): boolean {
  return repo.peers.some((peerId) => peerId === SYNC_SERVER_PEER_ID)
}

export async function waitForSyncServerPeer(
  repo: Repo,
  timeoutMs = 15_000,
): Promise<boolean> {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    if (hasSyncServerPeer(repo)) return true
    await sleep(100)
  }
  return hasSyncServerPeer(repo)
}

/**
 * Existing IndexedDB docs often finish loading before the WebSocket peer is up,
 * so the first share pass is a no-op. An empty change dirties sync state and
 * pushes the full document to the sync server for other devices to find.
 */
export async function nudgeDocToSyncServer(
  repo: Repo,
  url: AutomergeUrl | string,
): Promise<void> {
  const ready = await waitForSyncServerPeer(repo)
  if (!ready) return

  const handle = await repo.find(url as AutomergeUrl)
  await handle.whenReady()
  handle.update((doc) => Automerge.emptyChange(doc))
}
