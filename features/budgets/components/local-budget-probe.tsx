"use client"

import { useCallback, useEffect, useState } from "react"
import type { AutomergeUrl } from "@automerge/automerge-repo/slim"
import { useDocument, useRepo } from "@automerge/automerge-repo-react-hooks"

import { Button } from "@/components/ui/button"

import {
  createBudgetInRepo,
  findBudgetInRepo,
  LOCAL_BUDGET_URL_KEY,
  readStoredBudgetUrl,
  storeBudgetUrl,
} from "../repo/budget-handles"
import type { BudgetDoc } from "../types"

function BudgetEditor({ url }: { url: AutomergeUrl }) {
  const [doc, changeDoc] = useDocument<BudgetDoc>(url, { suspense: false })

  if (!doc) {
    return <p className="text-sm text-muted-foreground">Loading budget…</p>
  }

  return (
    <div className="flex flex-col gap-3">
      <label className="flex flex-col gap-1.5 text-sm">
        <span className="text-muted-foreground">Budget name (persists in IndexedDB)</span>
        <input
          className="rounded-md border border-input bg-background px-3 py-2 text-sm"
          value={doc.name}
          onChange={(event) => {
            const name = event.target.value
            changeDoc((draft) => {
              draft.name = name
            })
          }}
        />
      </label>
      <p className="text-xs text-muted-foreground break-all">
        Doc URL: {url}
      </p>
      <p className="text-xs text-muted-foreground">
        Refresh the page — the name should survive. Open a second tab to see
        BroadcastChannel sync.
      </p>
    </div>
  )
}

/**
 * Minimal probe that proves IndexedDB persistence for NAN-8.
 * Replace with real budget list UI in NAN-9.
 */
export function LocalBudgetProbe() {
  const repo = useRepo()
  const [url, setUrl] = useState<AutomergeUrl | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [booting, setBooting] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function boot() {
      setBooting(true)
      setError(null)
      try {
        const stored = readStoredBudgetUrl()
        if (stored) {
          await findBudgetInRepo(repo, stored)
          if (!cancelled) setUrl(stored)
          return
        }

        const handle = createBudgetInRepo(repo, {
          id: crypto.randomUUID(),
          name: "My first budget",
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
          defaultCurrency: "PHP",
        })
        storeBudgetUrl(handle.url)
        if (!cancelled) setUrl(handle.url)
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to open budget")
        }
      } finally {
        if (!cancelled) setBooting(false)
      }
    }

    void boot()
    return () => {
      cancelled = true
    }
  }, [repo])

  const reset = useCallback(() => {
    window.localStorage.removeItem(LOCAL_BUDGET_URL_KEY)
    setUrl(null)
    setBooting(true)
    const handle = createBudgetInRepo(repo, {
      id: crypto.randomUUID(),
      name: "My first budget",
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
      defaultCurrency: "PHP",
    })
    storeBudgetUrl(handle.url)
    setUrl(handle.url)
    setBooting(false)
  }, [repo])

  if (error) {
    return (
      <div className="flex flex-col gap-2">
        <p className="text-sm text-destructive">{error}</p>
        <Button type="button" variant="outline" size="sm" onClick={reset}>
          Create new local budget
        </Button>
      </div>
    )
  }

  if (booting || !url) {
    return <p className="text-sm text-muted-foreground">Opening local budget…</p>
  }

  return (
    <div className="flex flex-col gap-4">
      <BudgetEditor url={url} />
      <Button type="button" variant="ghost" size="sm" className="self-start" onClick={reset}>
        Reset local probe budget
      </Button>
    </div>
  )
}
