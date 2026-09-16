"use client"

import { useEffect, useState } from "react"
import { useRepo } from "@automerge/automerge-repo-react-hooks"

export type SyncPhase = "offline" | "online" | "syncing"

export type SyncStatus = {
  phase: SyncPhase
  online: boolean
  peerCount: number
  label: string
}

/**
 * Derived sync UI state:
 * - offline: browser reports offline
 * - syncing: online and at least one peer is connected (tab/network sync active)
 * - online: online with no peers (ready; waiting for remote/tab peers)
 */
export function useSyncStatus(): SyncStatus {
  const repo = useRepo()
  const [online, setOnline] = useState(
    typeof navigator === "undefined" ? true : navigator.onLine,
  )
  const [peerCount, setPeerCount] = useState(() => repo.peers.length)

  useEffect(() => {
    const onOnline = () => setOnline(true)
    const onOffline = () => setOnline(false)
    window.addEventListener("online", onOnline)
    window.addEventListener("offline", onOffline)

    const syncPeers = () => setPeerCount(repo.peers.length)
    syncPeers()

    // Repo emits document/peer activity through the network subsystem.
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

  const phase: SyncPhase = !online
    ? "offline"
    : peerCount > 0
      ? "syncing"
      : "online"

  const label =
    phase === "offline"
      ? "Offline"
      : phase === "syncing"
        ? `Syncing · ${peerCount} peer${peerCount === 1 ? "" : "s"}`
        : "Online · local only"

  return { phase, online, peerCount, label }
}
