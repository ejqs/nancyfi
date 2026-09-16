"use client"

import { useState } from "react"
import type { ChangeFn } from "@automerge/automerge/slim"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

import { formatMinor, parseMajorToMinor } from "../money-format"
import {
  applyUpsertEntry,
  applyVoidEntry,
  buildBalancingPostings,
} from "../mutations"
import type { Account, BudgetDoc, Entry, EntryStatus } from "../types"
import {
  ListRow,
  RowActions,
  RowMeta,
  RowTitle,
  StatusDot,
} from "./list-row"

const selectClassName =
  "h-7 w-full min-w-0 rounded-md border border-input bg-input/20 px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30 disabled:opacity-50 dark:bg-input/30"

type EntriesPanelProps = {
  doc: BudgetDoc
  changeDoc: (changeFn: ChangeFn<BudgetDoc>) => void
}

function todayLocalDate(): string {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, "0")
  const d = String(now.getDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

function sortEntries(entries: Entry[]): Entry[] {
  return [...entries].sort((a, b) => {
    if (a.effectiveAt !== b.effectiveAt) {
      return b.effectiveAt.localeCompare(a.effectiveAt)
    }
    return a.description.localeCompare(b.description)
  })
}

function accountLabel(accountsById: Record<string, Account>, id: string): string {
  return accountsById[id]?.name ?? id.slice(0, 8)
}

export function EntriesPanel({ doc, changeDoc }: EntriesPanelProps) {
  const activeAccounts = Object.values(doc.accountsById ?? {})
    .filter((account) => account.status === "active")
    .sort((a, b) => a.name.localeCompare(b.name))
  const entries = sortEntries(Object.values(doc.entriesById ?? {}))

  const [showForm, setShowForm] = useState(false)
  const [description, setDescription] = useState("")
  const [effectiveDate, setEffectiveDate] = useState(todayLocalDate)
  const [amount, setAmount] = useState("")
  const [fromAccountId, setFromAccountId] = useState("")
  const [toAccountId, setToAccountId] = useState("")
  const [status, setStatus] = useState<Exclude<EntryStatus, "void">>("posted")
  const [error, setError] = useState<string | null>(null)

  function resetForm() {
    setDescription("")
    setEffectiveDate(todayLocalDate())
    setAmount("")
    setFromAccountId("")
    setToAccountId("")
    setStatus("posted")
    setError(null)
    setShowForm(false)
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    const trimmed = description.trim()
    if (!trimmed) {
      setError("Description is required")
      return
    }
    if (!fromAccountId || !toAccountId) {
      setError("Choose both from and to accounts")
      return
    }

    try {
      const amountMinor = parseMajorToMinor(amount)
      const postings = buildBalancingPostings({
        fromAccountId,
        toAccountId,
        amountMinor,
        currency: doc.defaultCurrency,
        fromRole: "payment",
        toRole: "allocation",
      })
      const effectiveAt = new Date(`${effectiveDate}T12:00:00`).toISOString()

      changeDoc((draft) => {
        applyUpsertEntry(draft, {
          id: crypto.randomUUID(),
          description: trimmed,
          effectiveAt,
          status,
          postings,
        })
      })
      resetForm()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create entry")
    }
  }

  function handleVoid(entry: Entry) {
    if (entry.status === "void") return
    if (
      !window.confirm(
        `Void “${entry.description}”? History is kept; it is not deleted.`,
      )
    ) {
      return
    }
    try {
      changeDoc((draft) => {
        applyVoidEntry(draft, entry.id)
      })
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to void entry")
    }
  }

  function handlePostProposed(entry: Entry) {
    if (entry.status !== "proposed") return
    try {
      changeDoc((draft) => {
        applyUpsertEntry(draft, {
          id: entry.id,
          description: entry.description,
          effectiveAt: entry.effectiveAt,
          status: "posted",
          postings: entry.postings.map((posting) => ({
            accountId: posting.accountId,
            money: {
              amountMinor: posting.money.amountMinor,
              currency: posting.money.currency,
            },
            ...(posting.role ? { role: posting.role } : {}),
          })),
          ...(entry.sourcePlanOccurrenceId
            ? { sourcePlanOccurrenceId: entry.sourcePlanOccurrenceId }
            : {}),
        })
      })
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to post entry")
    }
  }

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="text-sm font-medium text-foreground">Activity</h2>
          <p className="text-xs text-muted-foreground">
            Record money moving between accounts. Confirm proposed items when
            ready.
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          onClick={() => setShowForm(true)}
          disabled={activeAccounts.length < 2}
        >
          + Entry
        </Button>
      </div>

      {activeAccounts.length < 2 ? (
        <p className="text-xs text-muted-foreground">
          Add at least two accounts before creating an entry.
        </p>
      ) : null}

      {showForm ? (
        <form
          onSubmit={handleSubmit}
          className="flex flex-col gap-3 rounded-md border border-border p-3"
        >
          <p className="text-xs font-medium text-foreground">New entry</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <Label htmlFor="entry-description">Description</Label>
              <Input
                id="entry-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                autoComplete="off"
                placeholder="Market run, paycheck…"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="entry-date">Date</Label>
              <Input
                id="entry-date"
                type="date"
                value={effectiveDate}
                onChange={(e) => setEffectiveDate(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="entry-amount">
                Amount ({doc.defaultCurrency})
              </Label>
              <Input
                id="entry-amount"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="250.00"
                autoComplete="off"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="entry-from">From account</Label>
              <select
                id="entry-from"
                className={selectClassName}
                value={fromAccountId}
                onChange={(e) => setFromAccountId(e.target.value)}
              >
                <option value="">Select…</option>
                {activeAccounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name} ({account.kind})
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="entry-to">To account</Label>
              <select
                id="entry-to"
                className={selectClassName}
                value={toAccountId}
                onChange={(e) => setToAccountId(e.target.value)}
              >
                <option value="">Select…</option>
                {activeAccounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name} ({account.kind})
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <Label htmlFor="entry-status">Status</Label>
              <select
                id="entry-status"
                className={selectClassName}
                value={status}
                onChange={(e) =>
                  setStatus(e.target.value as Exclude<EntryStatus, "void">)
                }
              >
                <option value="posted">Posted</option>
                <option value="proposed">Proposed</option>
              </select>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="submit">Create entry</Button>
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

      {entries.length === 0 ? (
        <p className="text-xs text-muted-foreground">No entries yet.</p>
      ) : (
        <div className="rounded-md border border-border/80">
          {entries.map((entry) => {
            const first = entry.postings[0]
            const second = entry.postings[1]
            const amountLabel =
              first && second
                ? formatMinor(
                    Math.abs(first.money.amountMinor),
                    first.money.currency,
                  )
                : "—"
            return (
              <ListRow key={entry.id}>
                <StatusDot
                  tone={
                    entry.status === "proposed"
                      ? "proposed"
                      : entry.status === "void"
                        ? "void"
                        : "posted"
                  }
                  label={entry.status}
                />
                <RowTitle>{entry.description}</RowTitle>
                <RowMeta>
                  {entry.effectiveAt.slice(0, 10)} · {amountLabel}
                  {first && second
                    ? ` · ${accountLabel(doc.accountsById, first.accountId)} → ${accountLabel(doc.accountsById, second.accountId)}`
                    : ""}
                </RowMeta>
                <RowActions>
                  {entry.status === "proposed" ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handlePostProposed(entry)}
                    >
                      Post
                    </Button>
                  ) : null}
                  {entry.status !== "void" ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleVoid(entry)}
                    >
                      Void
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
