"use client"

import { useState } from "react"
import type { ChangeFn } from "@automerge/automerge/slim"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

import {
  applyUpsertEntry,
  applyVoidEntry,
  buildBalancingPostings,
} from "../mutations"
import type { Account, BudgetDoc, Entry, EntryStatus } from "../types"

const selectClassName =
  "h-7 w-full min-w-0 rounded-md border border-input bg-input/20 px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30 disabled:opacity-50 dark:bg-input/30"

type EntriesPanelProps = {
  doc: BudgetDoc
  changeDoc: (changeFn: ChangeFn<BudgetDoc>) => void
}

function parseMajorToMinor(raw: string): number {
  const trimmed = raw.trim()
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) {
    throw new Error("Amount must be a positive number with up to 2 decimals")
  }
  const [whole, frac = ""] = trimmed.split(".")
  const minor = Number(whole) * 100 + Number((frac + "00").slice(0, 2))
  if (!Number.isInteger(minor) || minor <= 0) {
    throw new Error("Amount must be greater than zero")
  }
  return minor
}

function formatMinor(amountMinor: number, currency: string): string {
  const sign = amountMinor < 0 ? "-" : ""
  const abs = Math.abs(amountMinor)
  const major = Math.floor(abs / 100)
  const cents = String(abs % 100).padStart(2, "0")
  return `${sign}${major}.${cents} ${currency}`
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
        `Void “${entry.description}”? Posted history is kept; it is not deleted.`,
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
    <section className="flex flex-col gap-4 border-t border-border pt-6">
      <div>
        <h2 className="text-sm font-medium text-foreground">Entries</h2>
        <p className="text-xs text-muted-foreground">
          Simple amount + accounts form generates a balanced posting pair.
          Void posted history instead of deleting.
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="flex flex-col gap-3 rounded-md border border-border p-3"
      >
        <p className="text-xs font-medium text-foreground">New entry</p>
        {activeAccounts.length < 2 ? (
          <p className="text-xs text-muted-foreground">
            Add at least two accounts before creating an entry.
          </p>
        ) : (
          <>
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
            <Button type="submit">Create entry</Button>
          </>
        )}
        {error ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}
      </form>

      {entries.length === 0 ? (
        <p className="text-xs text-muted-foreground">No entries yet.</p>
      ) : (
        <ul className="flex flex-col gap-2">
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
              <li
                key={entry.id}
                className="flex flex-wrap items-start justify-between gap-2 rounded-md border border-border px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="text-sm text-foreground">
                    {entry.description}
                    <span className="ml-2 text-xs capitalize text-muted-foreground">
                      {entry.status}
                    </span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {entry.effectiveAt.slice(0, 10)} · {amountLabel}
                    {first && second
                      ? ` · ${accountLabel(doc.accountsById, first.accountId)} → ${accountLabel(doc.accountsById, second.accountId)}`
                      : ""}
                  </p>
                </div>
                <div className="flex gap-1">
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
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
