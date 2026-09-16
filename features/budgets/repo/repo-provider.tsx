"use client"

import { useEffect, useState, type ReactNode } from "react"
import { RepoContext } from "@automerge/automerge-repo-react-hooks"
import type { Repo } from "@automerge/automerge-repo/slim"

import { getOrCreateBrowserRepo } from "./create-browser-repo"
import { ensureAutomergeWasm } from "./ensure-wasm"

export function BudgetRepoProvider({ children }: { children: ReactNode }) {
  const [repo, setRepo] = useState<Repo | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function boot() {
      try {
        await ensureAutomergeWasm()
        if (cancelled) return
        setRepo(getOrCreateBrowserRepo())
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Failed to start Automerge",
          )
        }
      }
    }

    void boot()
    return () => {
      cancelled = true
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
