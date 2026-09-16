"use client"

import { useState } from "react"
import type { ChangeFn } from "@automerge/automerge/slim"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

import { applyUpsertAccount } from "../mutations"
import type { Account, AccountKind, BudgetDoc } from "../types"

const ACCOUNT_KINDS: AccountKind[] = [
  "asset",
  "liability",
  "income",
  "expense",
]

const selectClassName =
  "h-7 w-full min-w-0 rounded-md border border-input bg-input/20 px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30 disabled:opacity-50 dark:bg-input/30"

type AccountsPanelProps = {
  doc: BudgetDoc
  changeDoc: (changeFn: ChangeFn<BudgetDoc>) => void
}

function sortAccounts(accounts: Account[]): Account[] {
  return [...accounts].sort((a, b) => {
    if (a.kind !== b.kind) return a.kind.localeCompare(b.kind)
    return a.name.localeCompare(b.name)
  })
}

export function AccountsPanel({ doc, changeDoc }: AccountsPanelProps) {
  const accounts = sortAccounts(Object.values(doc.accountsById ?? {}))
  const [editingId, setEditingId] = useState<string | null>(null)
  const [name, setName] = useState("")
  const [kind, setKind] = useState<AccountKind>("asset")
  const [parentId, setParentId] = useState("")
  const [error, setError] = useState<string | null>(null)

  function resetForm() {
    setEditingId(null)
    setName("")
    setKind("asset")
    setParentId("")
    setError(null)
  }

  function startEdit(account: Account) {
    setEditingId(account.id)
    setName(account.name)
    setKind(account.kind)
    setParentId(account.parentId ?? "")
    setError(null)
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) {
      setError("Name is required")
      return
    }

    const id = editingId ?? crypto.randomUUID()
    try {
      changeDoc((draft) => {
        applyUpsertAccount(draft, {
          id,
          name: trimmed,
          kind,
          parentId: parentId || null,
          status: "active",
        })
      })
      resetForm()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save account")
    }
  }

  function handleArchive(account: Account) {
    if (
      !window.confirm(
        `Archive “${account.name}”? History that references it is kept.`,
      )
    ) {
      return
    }
    try {
      changeDoc((draft) => {
        applyUpsertAccount(draft, {
          id: account.id,
          name: account.name,
          kind: account.kind,
          parentId: account.parentId ?? null,
          currency: account.currency ?? null,
          status: "archived",
        })
      })
      if (editingId === account.id) resetForm()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to archive account")
    }
  }

  const parentOptions = accounts.filter(
    (account) =>
      account.status === "active" &&
      account.id !== editingId &&
      account.kind === kind,
  )

  return (
    <section className="flex flex-col gap-4 border-t border-border pt-6">
      <div>
        <h2 className="text-sm font-medium text-foreground">Accounts</h2>
        <p className="text-xs text-muted-foreground">
          Containers and category hierarchy (asset, liability, income, expense).
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="flex flex-col gap-3 rounded-md border border-border p-3"
      >
        <p className="text-xs font-medium text-foreground">
          {editingId ? "Edit account" : "New account"}
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="account-name">Name</Label>
            <Input
              id="account-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="off"
              placeholder="Checking, Groceries…"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="account-kind">Kind</Label>
            <select
              id="account-kind"
              className={selectClassName}
              value={kind}
              onChange={(e) => {
                setKind(e.target.value as AccountKind)
                setParentId("")
              }}
            >
              {ACCOUNT_KINDS.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <Label htmlFor="account-parent">Parent (optional)</Label>
            <select
              id="account-parent"
              className={selectClassName}
              value={parentId}
              onChange={(e) => setParentId(e.target.value)}
            >
              <option value="">None</option>
              {parentOptions.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="submit">{editingId ? "Save account" : "Add account"}</Button>
          {editingId ? (
            <Button type="button" variant="ghost" onClick={resetForm}>
              Cancel
            </Button>
          ) : null}
        </div>
        {error ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}
      </form>

      {accounts.length === 0 ? (
        <p className="text-xs text-muted-foreground">No accounts yet.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {accounts.map((account) => {
            const parentName = account.parentId
              ? doc.accountsById[account.parentId]?.name
              : null
            return (
              <li
                key={account.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm text-foreground">
                    {account.name}
                    {account.status === "archived" ? (
                      <span className="ml-2 text-xs text-muted-foreground">
                        archived
                      </span>
                    ) : null}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {account.kind}
                    {parentName ? ` · under ${parentName}` : ""}
                  </p>
                </div>
                <div className="flex gap-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => startEdit(account)}
                  >
                    Edit
                  </Button>
                  {account.status === "active" ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleArchive(account)}
                    >
                      Archive
                    </Button>
                  ) : null}
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
