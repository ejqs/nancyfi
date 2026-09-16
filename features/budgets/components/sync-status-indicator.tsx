"use client"

import { cn } from "@/lib/utils"

import { useSyncStatus, type SyncPhase } from "../repo/use-sync-status"

const phaseClass: Record<SyncPhase, string> = {
  offline: "bg-muted text-muted-foreground",
  online: "bg-emerald-500/10 text-emerald-800 dark:text-emerald-300",
  syncing: "bg-amber-500/10 text-amber-900 dark:text-amber-200",
}

export function SyncStatusIndicator({ className }: { className?: string }) {
  const status = useSyncStatus()

  return (
    <p
      className={cn(
        "inline-flex items-center rounded-md px-2 py-1 text-xs font-medium",
        phaseClass[status.phase],
        className,
      )}
      data-sync-phase={status.phase}
      title="Local Automerge sync status (IndexedDB + BroadcastChannel)"
    >
      <span
        className={cn(
          "mr-1.5 size-1.5 rounded-full",
          status.phase === "offline" && "bg-muted-foreground",
          status.phase === "online" && "bg-emerald-600",
          status.phase === "syncing" && "animate-pulse bg-amber-600",
        )}
        aria-hidden
      />
      {status.label}
    </p>
  )
}
