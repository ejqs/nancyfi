"use client"

import { useState } from "react"
import type { ChangeFn } from "@automerge/automerge/slim"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

import { listAccountBalances } from "../balances"
import { formatMinor } from "../money-format"
import { applyUpsertAccount } from "../mutations"
import type { Account, AccountKind, BudgetDoc } from "../types"
import {
  ListRow,
  RowActions,
  RowMeta,
  RowTitle,
  StatusDot,
} from "./list-row"

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
  const balances = listAccountBalances(doc)
  const balanceById = new Map(
    balances.map((row) => [row.account.id, row] as const),
  )
  const [showForm, setShowForm] = useState(false)
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
    setShowForm(false)
  }

  function startCreate() {
    setEditingId(null)
    setName("")
    setKind("asset")
    setParentId("")
    setError(null)
    setShowForm(true)
  }

  function startEdit(account: Account) {
    setEditingId(account.id)
    setName(account.name)
    setKind(account.kind)
    setParentId(account.parentId ?? "")
    setError(null)
    setShowForm(true)
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
    <section className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="text-sm font-medium text-foreground">Accounts</h2>
          <p className="text-xs text-muted-foreground">
            Where money lives — cash, cards, income, and spending categories.
          </p>
        </div>
        <Button type="button" size="sm" onClick={startCreate}>
          + Account
        </Button>
      </div>

      {showForm ? (
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
              <Label htmlFor="account-kind">Type</Label>
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
            <Button type="submit">
              {editingId ? "Save account" : "Add account"}
            </Button>
            <Button type="button" variant="ghost" onClick={resetForm}>
              Cancel
            </Button>
          </div>
          {error ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}
        </form>
      ) : null}

      {accounts.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          No accounts yet. Add one to start recording money.
        </p>
      ) : (
        <div className="rounded-md border border-border/80">
          {accounts.map((account) => {
            const parentName = account.parentId
              ? doc.accountsById[account.parentId]?.name
              : null
            const balance = balanceById.get(account.id)
            return (
              <ListRow key={account.id}>
                <StatusDot
                  tone={account.status === "active" ? "active" : "muted"}
                  label={account.kind}
                />
                <RowTitle>
                  {account.name}
                  {account.status === "archived" ? " (archived)" : ""}
                </RowTitle>
                <RowMeta>
                  {account.kind}
                  {parentName ? ` · ${parentName}` : ""}
                  {balance
                    ? ` · ${formatMinor(balance.balanceMinor, balance.currency)}`
                    : ""}
                </RowMeta>
                <RowActions>
                  <Button
                    type="button"
                    variant="ghost"
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
                </RowActions>
              </ListRow>
            )
          })}
        </div>
      )}
    </section>
  )
}
