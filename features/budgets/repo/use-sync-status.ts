"use client"

import { useEffect, useState } from "react"
import { useRepo } from "@automerge/automerge-repo-react-hooks"

import { getAutomergeSyncUrl } from "./create-browser-repo"
import { hasSyncServerPeer } from "./nudge-remote-sync"
import { deriveSyncPhase, type SyncPhase } from "./sync-status"

export type { SyncPhase } from "./sync-status"

export type SyncStatus = {
  phase: SyncPhase
  online: boolean
  peerCount: number
  syncServerConnected: boolean
  label: string
  syncConfigured: boolean
}

/**
 * Derived sync UI state:
 * - offline: browser reports offline
 * - syncing: remote sync is configured but the sync server peer is not connected
 * - online / Synced: local-only ready, or connected to `nancyfi-sync-server`
 */
export function useSyncStatus(): SyncStatus {
  const repo = useRepo()
  const syncConfigured = Boolean(getAutomergeSyncUrl())
  const [online, setOnline] = useState(
    typeof navigator === "undefined" ? true : navigator.onLine,
  )
  const [peerCount, setPeerCount] = useState(() => repo.peers.length)
  const [syncServerConnected, setSyncServerConnected] = useState(() =>
    hasSyncServerPeer(repo),
  )

  useEffect(() => {
    const onOnline = () => setOnline(true)
    const onOffline = () => setOnline(false)
    window.addEventListener("online", onOnline)
    window.addEventListener("offline", onOffline)

    const syncPeers = () => {
      setPeerCount(repo.peers.length)
      setSyncServerConnected(hasSyncServerPeer(repo))
    }
    syncPeers()

    const network = repo.networkSubsystem
    network.on("peer", syncPeers)
    network.on("peer-disconnected", syncPeers)

    const interval = window.setInterval(syncPeers, 1500)

    return () => {
      window.removeEventListener("online", onOnline)
      window.removeEventListener("offline", onOffline)
      network.off("peer", syncPeers)
      network.off("peer-disconnected", syncPeers)
      window.clearInterval(interval)
    }
  }, [repo])

  const phase: SyncPhase = deriveSyncPhase({
    online,
    syncConfigured,
    peerCount,
    syncServerConnected,
  })

  const label =
    phase === "offline"
      ? "Offline"
      : phase === "syncing"
        ? "Syncing"
        : syncConfigured
          ? "Synced"
          : "Local only"

  return {
    phase,
    online,
    peerCount,
    syncServerConnected,
    label,
    syncConfigured,
  }
}
