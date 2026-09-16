"use client"

import { useState } from "react"
import type { ChangeFn } from "@automerge/automerge/slim"
import { MoreHorizontal } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"

import { formatMinor, parseMajorToMinor } from "../money-format"
import {
  applyUpsertEntry,
  applyVoidEntry,
} from "../mutations"
import {
  applyRecordExpense,
  applyRecordIncome,
  applyRecordTransfer,
} from "../scenario-commands"
import type { Account, BudgetDoc, Entry } from "../types"
import {
  ListRow,
  RowActions,
  RowMeta,
  RowTitle,
  StatusDot,
} from "./list-row"

type TransactionKind = "expense" | "income" | "transfer"

type TransactionsPanelProps = {
  doc: BudgetDoc
  changeDoc: (changeFn: ChangeFn<BudgetDoc>) => void
  openCreate?: boolean
  onCreateOpenChange?: (open: boolean) => void
}

const selectClassName =
  "h-7 w-full rounded-md border border-input bg-input/20 px-2 text-xs outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"

function localDate(): string {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, "0")
  const d = String(now.getDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

function sortEntries(entries: Entry[]): Entry[] {
  return [...entries].sort((a, b) => b.effectiveAt.localeCompare(a.effectiveAt))
}

function accountName(accounts: Record<string, Account>, id: string): string {
  return accounts[id]?.name ?? "Unknown"
}

export function TransactionsPanel({
  doc,
  changeDoc,
  openCreate,
  onCreateOpenChange,
}: TransactionsPanelProps) {
  const [internalOpen, setInternalOpen] = useState(false)
  const open = openCreate ?? internalOpen
  const setOpen = onCreateOpenChange ?? setInternalOpen
  const [kind, setKind] = useState<TransactionKind>("expense")
  const [description, setDescription] = useState("")
  const [date, setDate] = useState(localDate)
  const [amount, setAmount] = useState("")
  const [primaryAccountId, setPrimaryAccountId] = useState("")
  const [secondaryAccountId, setSecondaryAccountId] = useState("")
  const [categoryOrSource, setCategoryOrSource] = useState("")
  const [error, setError] = useState<string | null>(null)

  const assets = Object.values(doc.accountsById ?? {})
    .filter((account) => account.status === "active" && account.kind === "asset")
    .sort((a, b) => a.name.localeCompare(b.name))
  const entries = sortEntries(Object.values(doc.entriesById ?? {}))

  function reset() {
    setKind("expense")
    setDescription("")
    setDate(localDate())
    setAmount("")
    setPrimaryAccountId("")
    setSecondaryAccountId("")
    setCategoryOrSource("")
    setError(null)
  }

  function close() {
    setOpen(false)
    reset()
  }

  function save(event: React.FormEvent) {
    event.preventDefault()
    if (!primaryAccountId) {
      setError(kind === "income" ? "Choose where it was deposited" : "Choose where the money came from")
      return
    }
    if (kind === "transfer" && !secondaryAccountId) {
      setError("Choose where the money moved to")
      return
    }
    if (kind !== "transfer" && !categoryOrSource.trim()) {
      setError(kind === "income" ? "Name the income source" : "Name the spending category")
      return
    }

    try {
      const amountMinor = parseMajorToMinor(amount)
      const effectiveAt = new Date(`${date}T12:00:00`).toISOString()
      changeDoc((draft) => {
        if (kind === "expense") {
          applyRecordExpense(draft, {
            description,
            effectiveAt,
            amountMinor,
            paymentAccountId: primaryAccountId,
            category: { name: categoryOrSource },
          })
          return
        }
        if (kind === "income") {
          applyRecordIncome(draft, {
            description,
            effectiveAt,
            amountMinor,
            depositAccountId: primaryAccountId,
            source: { name: categoryOrSource },
          })
          return
        }
        applyRecordTransfer(draft, {
          description,
          effectiveAt,
          amountMinor,
          fromAccountId: primaryAccountId,
          toAccountId: secondaryAccountId,
        })
      })
      close()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save transaction")
    }
  }

  function confirm(entry: Entry) {
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
  }

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-medium">Transactions</h2>
          <p className="text-xs text-muted-foreground">
            Expenses, income, and transfers in one place.
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          onClick={() => {
            setError(null)
            setOpen(true)
          }}
        >
          Add transaction
        </Button>
      </div>

      {assets.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          Add a bank or cash account in Settings before recording money.
        </p>
      ) : null}

      {entries.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          No transactions yet. Record an expense, income, or transfer.
        </p>
      ) : (
        <div className="rounded-md border border-border/80">
          {entries.map((entry) => {
            const first = entry.postings[0]
            const second = entry.postings[1]
            const amount = first
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
                  label={
                    entry.status === "proposed"
                      ? "needs review"
                      : entry.status === "void"
                        ? "undone"
                        : "confirmed"
                  }
                />
                <RowTitle>{entry.description}</RowTitle>
                <RowMeta>
                  {entry.effectiveAt.slice(0, 10)} · {amount}
                  {first && second
                    ? ` · ${accountName(doc.accountsById, first.accountId)} → ${accountName(doc.accountsById, second.accountId)}`
                    : ""}
                </RowMeta>
                <RowActions>
                  {entry.status === "proposed" ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => confirm(entry)}
                    >
                      Confirm
                    </Button>
                  ) : null}
                  {entry.status !== "void" ? (
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        render={
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            aria-label={`More actions for ${entry.description}`}
                          />
                        }
                      >
                        <MoreHorizontal />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuGroup>
                          <DropdownMenuItem
                            variant="destructive"
                            onClick={() => {
                              if (
                                window.confirm(
                                  "Undo this transaction? It stays in history but no longer affects balances.",
                                )
                              ) {
                                changeDoc((draft) => {
                                  applyVoidEntry(draft, entry.id)
                                })
                              }
                            }}
                          >
                            Undo transaction
                          </DropdownMenuItem>
                        </DropdownMenuGroup>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  ) : null}
                </RowActions>
              </ListRow>
            )
          })}
        </div>
      )}

      <Dialog
        open={open}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) reset()
          setOpen(nextOpen)
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Add transaction</DialogTitle>
            <DialogDescription>
              Choose what happened. Nancyfi handles the accounting entries.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={save} className="flex flex-col gap-4">
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="transaction-kind">What happened?</FieldLabel>
                <select
                  id="transaction-kind"
                  className={selectClassName}
                  value={kind}
                  onChange={(event) => {
                    setKind(event.target.value as TransactionKind)
                    setPrimaryAccountId("")
                    setSecondaryAccountId("")
                    setCategoryOrSource("")
                  }}
                >
                  <option value="expense">Expense</option>
                  <option value="income">Income</option>
                  <option value="transfer">Transfer</option>
                </select>
              </Field>
              <Field>
                <FieldLabel htmlFor="transaction-description">
                  Description
                </FieldLabel>
                <Input
                  id="transaction-description"
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder={
                    kind === "expense"
                      ? "Market run"
                      : kind === "income"
                        ? "Payday"
                        : "Move to savings"
                  }
                />
              </Field>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="transaction-date">Date</FieldLabel>
                  <Input
                    id="transaction-date"
                    type="date"
                    value={date}
                    onChange={(event) => setDate(event.target.value)}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="transaction-amount">
                    Amount ({doc.defaultCurrency})
                  </FieldLabel>
                  <Input
                    id="transaction-amount"
                    inputMode="decimal"
                    value={amount}
                    onChange={(event) => setAmount(event.target.value)}
                    placeholder="250.00"
                  />
                </Field>
              </div>
              <Field>
                <FieldLabel htmlFor="transaction-primary-account">
                  {kind === "income" ? "Deposited to" : "Money came from"}
                </FieldLabel>
                <select
                  id="transaction-primary-account"
                  className={selectClassName}
                  value={primaryAccountId}
                  onChange={(event) => setPrimaryAccountId(event.target.value)}
                >
                  <option value="">Choose bank or cash…</option>
                  {assets.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.name}
                    </option>
                  ))}
                </select>
              </Field>
              {kind === "transfer" ? (
                <Field>
                  <FieldLabel htmlFor="transaction-secondary-account">
                    Money moved to
                  </FieldLabel>
                  <select
                    id="transaction-secondary-account"
                    className={selectClassName}
                    value={secondaryAccountId}
                    onChange={(event) =>
                      setSecondaryAccountId(event.target.value)
                    }
                  >
                    <option value="">Choose destination…</option>
                    {assets
                      .filter((account) => account.id !== primaryAccountId)
                      .map((account) => (
                        <option key={account.id} value={account.id}>
                          {account.name}
                        </option>
                      ))}
                  </select>
                </Field>
              ) : (
                <Field>
                  <FieldLabel htmlFor="transaction-category">
                    {kind === "income" ? "Income source" : "Spending category"}
                  </FieldLabel>
                  <Input
                    id="transaction-category"
                    value={categoryOrSource}
                    onChange={(event) =>
                      setCategoryOrSource(event.target.value)
                    }
                    placeholder={kind === "income" ? "Company" : "Food"}
                  />
                </Field>
              )}
              {error ? <FieldError>{error}</FieldError> : null}
            </FieldGroup>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={close}>
                Cancel
              </Button>
              <Button type="submit" disabled={assets.length === 0}>
                Save transaction
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  )
}
