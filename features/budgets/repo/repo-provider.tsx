"use client"

import {
  useEffect,
  useEffectEvent,
  useState,
  type ReactNode,
} from "react"
import { RepoContext } from "@automerge/automerge-repo-react-hooks"
import type { PeerId, Repo } from "@automerge/automerge-repo/slim"

import { getSyncTokenAction } from "../actions"
import {
  createBrowserRepo,
  getAutomergeSyncUrl,
  getOrCreateBrowserRepo,
  replaceBrowserSyncAuth,
} from "./create-browser-repo"
import { ensureAutomergeWasm } from "./ensure-wasm"
import { SYNC_TOKEN_REFRESH_MARGIN_MS } from "./sync-token"

function newSyncPeerId(): PeerId {
  return `nf-${crypto.randomUUID()}` as PeerId
}

/**
 * Notify the budget repo provider to refresh sync JWT allowlists
 * (e.g. after create budget / accept invite).
 */
export function requestSyncCredentialsRefresh(): void {
  if (typeof window === "undefined") return
  window.dispatchEvent(new Event("nancyfi:refresh-sync-credentials"))
}

export function BudgetRepoProvider({ children }: { children: ReactNode }) {
  const [repo, setRepo] = useState<Repo | null>(null)
  const [error, setError] = useState<string | null>(null)

  const fetchCredentials = useEffectEvent(async (peerId: PeerId) => {
    const result = await getSyncTokenAction({ peerId })
    if (!result.ok) {
      throw new Error(result.error)
    }
    return result.data
  })

  useEffect(() => {
    let cancelled = false
    let refreshTimer: ReturnType<typeof setTimeout> | undefined
    let peerId = newSyncPeerId()
    let activeRepo: Repo | null = null

    async function boot() {
      try {
        await ensureAutomergeWasm()
        if (cancelled) return

        const syncConfigured = Boolean(getAutomergeSyncUrl())
        if (!syncConfigured) {
          const local = getOrCreateBrowserRepo()
          activeRepo = local
          setRepo(local)
          return
        }

        const credentials = await fetchCredentials(peerId)
        if (cancelled) return
        peerId = credentials.peerId as PeerId
        const next = createBrowserRepo({
          peerId,
          token: credentials.token,
        })
        activeRepo = next
        setRepo(next)
        scheduleRefresh(credentials.refreshAt)
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "Failed to start local budget store",
          )
        }
      }
    }

    function scheduleRefresh(refreshAt: number) {
      if (refreshTimer) clearTimeout(refreshTimer)
      const delay = Math.max(5_000, refreshAt - Date.now())
      refreshTimer = setTimeout(() => {
        void refresh()
      }, delay)
    }

    async function refresh() {
      if (!activeRepo || !getAutomergeSyncUrl()) return
      try {
        const credentials = await fetchCredentials(peerId)
        if (cancelled || !activeRepo) return
        peerId = credentials.peerId as PeerId
        replaceBrowserSyncAuth(activeRepo, credentials.token)
        scheduleRefresh(credentials.refreshAt)
      } catch (err) {
        console.warn(
          "[nancyfi] sync credential refresh failed",
          err instanceof Error ? err.message : err,
        )
        scheduleRefresh(Date.now() + SYNC_TOKEN_REFRESH_MARGIN_MS)
      }
    }

    function onRefreshRequest() {
      void refresh()
    }

    void boot()
    window.addEventListener(
      "nancyfi:refresh-sync-credentials",
      onRefreshRequest,
    )

    return () => {
      cancelled = true
      if (refreshTimer) clearTimeout(refreshTimer)
      window.removeEventListener(
        "nancyfi:refresh-sync-credentials",
        onRefreshRequest,
      )
    }
  }, [])

  if (error) {
    return (
      <div className="text-sm text-destructive" role="alert">
        {error}
      </div>
    )
  }

  if (!repo) {
    return (
      <div className="text-sm text-muted-foreground" aria-live="polite">
        Starting local budget store…
      </div>
    )
  }

  return <RepoContext.Provider value={repo}>{children}</RepoContext.Provider>
}
