"use client"

import { useEffect, useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useRepo } from "@automerge/automerge-repo-react-hooks"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

import {
  createBudgetAction,
  listBudgetsAction,
  type BudgetListItem,
} from "../actions"
import { createBudgetInRepo } from "../repo/budget-handles"

export function BudgetListPanel({
  onBudgetsChange,
}: {
  onBudgetsChange?: (budgets: BudgetListItem[]) => void
} = {}) {
  const repo = useRepo()
  const router = useRouter()
  const [budgets, setBudgets] = useState<BudgetListItem[]>([])
  const [name, setName] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [pending, startTransition] = useTransition()

  function updateBudgets(next: BudgetListItem[]) {
    setBudgets(next)
    onBudgetsChange?.(next)
  }

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      const result = await listBudgetsAction()
      if (cancelled) return
      if (!result.ok) {
        setError(result.error)
        updateBudgets([])
      } else {
        setError(null)
        updateBudgets(result.data)
      }
      setLoading(false)
    }
    void load()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load once on mount
  }, [])

  function refreshList() {
    startTransition(async () => {
      const result = await listBudgetsAction()
      if (!result.ok) {
        setError(result.error)
        return
      }
      updateBudgets(result.data)
      setError(null)
    })
  }

  function handleCreate(event: React.FormEvent) {
    event.preventDefault()
    const trimmed = name.trim() || "Untitled budget"
    setError(null)

    startTransition(async () => {
      try {
        const id = crypto.randomUUID()
        const handle = createBudgetInRepo(repo, {
          id,
          name: trimmed,
          timezone:
            Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
          defaultCurrency: "PHP",
        })
        const result = await createBudgetAction({
          id,
          name: trimmed,
          automergeUrl: handle.url,
        })
        if (!result.ok) {
          setError(result.error)
          return
        }
        setName("")
        updateBudgets([result.data, ...budgets.filter((b) => b.id !== result.data.id)])
        router.push(`/budgets/${id}`)
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to create budget")
      }
    })
  }

  return (
    <div className="flex flex-col gap-6">
      <form onSubmit={handleCreate} className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex flex-1 flex-col gap-1.5">
          <Label htmlFor="new-budget-name">New budget</Label>
          <Input
            id="new-budget-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Household, Travel, …"
            disabled={pending}
            autoComplete="off"
          />
        </div>
        <Button type="submit" disabled={pending}>
          {pending ? "Creating…" : "Create"}
        </Button>
      </form>

      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-medium text-muted-foreground">
            Your budgets
          </p>
          <Button
            type="button"
            variant="ghost"
            size="xs"
            onClick={refreshList}
            disabled={pending || loading}
          >
            Refresh
          </Button>
        </div>

        {loading ? (
          <p className="text-sm text-muted-foreground">Loading budgets…</p>
        ) : budgets.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No budgets yet. Create one to get started.
          </p>
        ) : (
          <ul className="divide-y divide-border rounded-lg ring-1 ring-foreground/10">
            {budgets.map((budget) => (
              <li key={budget.id}>
                <Link
                  href={`/budgets/${budget.id}`}
                  className="flex items-center justify-between gap-3 px-3 py-2.5 transition-colors hover:bg-muted/50"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{budget.name}</p>
                    <p className="text-xs text-muted-foreground capitalize">
                      {budget.role === "owner" ? "Owner" : "Contributor"}
                    </p>
                  </div>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    Open
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
