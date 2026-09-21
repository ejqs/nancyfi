"use client"

import { useMemo, useState } from "react"
import type { ChangeFn } from "@automerge/automerge/slim"

import { Button } from "@/components/ui/button"
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"

import { parseMajorToMinor } from "../money-format"
import {
  applyRecordNestedRepayment,
  applyRecordPurchase,
} from "../scenario-commands"
import { buildCatalogSheet, buildDebtsSheet } from "../sheets"
import type { BudgetDoc } from "../types"
import { NestedSheetTable } from "./nested-sheet-table"

type SheetsPanelProps = {
  doc: BudgetDoc
  changeDoc: (changeFn: ChangeFn<BudgetDoc>) => void
}

const selectClassName =
  "h-7 w-full min-w-0 rounded-md border border-input bg-input/20 px-2 text-xs outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"

function todayLocalDate(): string {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, "0")
  const d = String(now.getDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

export function SheetsPanel({ doc, changeDoc }: SheetsPanelProps) {
  const catalog = useMemo(() => buildCatalogSheet(doc), [doc])
  const debts = useMemo(() => buildDebtsSheet(doc), [doc])
  const moneyAccounts = Object.values(doc.accountsById ?? {})
    .filter(
      (account) =>
        account.status === "active" &&
        (account.kind === "asset" || account.kind === "liability"),
    )
    .sort((a, b) => a.name.localeCompare(b.name))
  const assets = moneyAccounts.filter((account) => account.kind === "asset")

  const [showPurchase, setShowPurchase] = useState(false)
  const [purchaseName, setPurchaseName] = useState("")
  const [purchaseAmount, setPurchaseAmount] = useState("")
  const [purchaseFrom, setPurchaseFrom] = useState("")
  const [purchaseCategory, setPurchaseCategory] = useState("")
  const [purchaseDate, setPurchaseDate] = useState(todayLocalDate)
  const [nestUnder, setNestUnder] = useState<string | null>(null)
  const [repayAmount, setRepayAmount] = useState("")
  const [repayFrom, setRepayFrom] = useState("")
  const [repayDate, setRepayDate] = useState(todayLocalDate)
  const [repayProposed, setRepayProposed] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function handlePurchase(event: React.FormEvent) {
    event.preventDefault()
    try {
      const amountMinor = parseMajorToMinor(purchaseAmount)
      changeDoc((draft) => {
        applyRecordPurchase(draft, {
          description: purchaseName.trim() || "Purchase",
          effectiveAt: new Date(`${purchaseDate}T12:00:00`).toISOString(),
          amountMinor,
          fromAccountId: purchaseFrom,
          category: {
            name: purchaseCategory.trim() || purchaseName.trim() || "Purchase",
          },
        })
      })
      setShowPurchase(false)
      setPurchaseName("")
      setPurchaseAmount("")
      setPurchaseCategory("")
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add purchase")
    }
  }

  function handleRepayment(event: React.FormEvent) {
    event.preventDefault()
    if (!nestUnder) return
    try {
      const amountMinor = parseMajorToMinor(repayAmount)
      changeDoc((draft) => {
        applyRecordNestedRepayment(draft, {
          parentId: nestUnder,
          effectiveAt: new Date(`${repayDate}T12:00:00`).toISOString(),
          amountMinor,
          paymentAccountId: repayFrom,
          status: repayProposed ? "proposed" : "posted",
        })
      })
      setNestUnder(null)
      setRepayAmount("")
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not nest repayment")
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h2 className="text-sm font-medium">Sheets</h2>
        <p className="text-xs text-muted-foreground">
          Nested grid on the same Automerge document. Expand uses TanStack
          Table. Job lists (Payday / Recurring / Transactions) stay until the
          rest of the pivot.
        </p>
      </div>

      <section className="flex flex-col gap-3">
        <div>
          <h3 className="text-sm font-medium">{catalog.title}</h3>
          <p className="text-xs text-muted-foreground">{catalog.description}</p>
          <p className="mt-1 text-[0.65rem] text-muted-foreground">
            {catalog.summaryLabel}
          </p>
        </div>
        <NestedSheetTable
          rows={catalog.rows}
          emptyLabel={catalog.emptyLabel}
        />
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h3 className="text-sm font-medium">{debts.title}</h3>
            <p className="text-xs text-muted-foreground">{debts.description}</p>
            <p className="mt-1 text-[0.65rem] text-muted-foreground">
              {debts.summaryLabel}
            </p>
          </div>
          <Button
            type="button"
            size="sm"
            onClick={() => setShowPurchase(true)}
            disabled={moneyAccounts.length === 0}
          >
            Add purchase
          </Button>
        </div>

        {showPurchase ? (
          <form
            onSubmit={handlePurchase}
            className="rounded-md border border-border p-3"
          >
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="purchase-name">Item</FieldLabel>
                <Input
                  id="purchase-name"
                  value={purchaseName}
                  onChange={(event) => setPurchaseName(event.target.value)}
                  placeholder="Headphones-this-buy"
                  autoComplete="off"
                />
              </Field>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="purchase-amount">
                    Amount ({doc.defaultCurrency})
                  </FieldLabel>
                  <Input
                    id="purchase-amount"
                    inputMode="decimal"
                    value={purchaseAmount}
                    onChange={(event) => setPurchaseAmount(event.target.value)}
                    placeholder="279.99"
                    autoComplete="off"
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="purchase-date">Date</FieldLabel>
                  <Input
                    id="purchase-date"
                    type="date"
                    value={purchaseDate}
                    onChange={(event) => setPurchaseDate(event.target.value)}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="purchase-from">
                    Settlement / cash
                  </FieldLabel>
                  <select
                    id="purchase-from"
                    className={selectClassName}
                    value={purchaseFrom}
                    onChange={(event) => setPurchaseFrom(event.target.value)}
                    required
                  >
                    <option value="">Select…</option>
                    {moneyAccounts.map((account) => (
                      <option key={account.id} value={account.id}>
                        {account.name} ({account.kind})
                      </option>
                    ))}
                  </select>
                </Field>
                <Field>
                  <FieldLabel htmlFor="purchase-category">
                    Expense category
                  </FieldLabel>
                  <Input
                    id="purchase-category"
                    value={purchaseCategory}
                    onChange={(event) =>
                      setPurchaseCategory(event.target.value)
                    }
                    placeholder="Gadgets"
                    autoComplete="off"
                  />
                </Field>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="submit">Save purchase Entry</Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setShowPurchase(false)}
                >
                  Cancel
                </Button>
              </div>
            </FieldGroup>
          </form>
        ) : null}

        {nestUnder ? (
          <form
            onSubmit={handleRepayment}
            className="rounded-md border border-border p-3"
          >
            <p className="text-xs font-medium">
              Nest repayment under{" "}
              {doc.entriesById[nestUnder]?.description ?? nestUnder}
            </p>
            <FieldGroup>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="repay-amount">
                    Amount ({doc.defaultCurrency})
                  </FieldLabel>
                  <Input
                    id="repay-amount"
                    inputMode="decimal"
                    value={repayAmount}
                    onChange={(event) => setRepayAmount(event.target.value)}
                    placeholder="5.83"
                    autoComplete="off"
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="repay-date">Date</FieldLabel>
                  <Input
                    id="repay-date"
                    type="date"
                    value={repayDate}
                    onChange={(event) => setRepayDate(event.target.value)}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="repay-from">Paid from</FieldLabel>
                  <select
                    id="repay-from"
                    className={selectClassName}
                    value={repayFrom}
                    onChange={(event) => setRepayFrom(event.target.value)}
                    required
                  >
                    <option value="">Select…</option>
                    {assets.map((account) => (
                      <option key={account.id} value={account.id}>
                        {account.name}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                <input
                  type="checkbox"
                  checked={repayProposed}
                  onChange={(event) => setRepayProposed(event.target.checked)}
                />
                Leave as proposed (does not reduce remaining yet)
              </label>
              <div className="flex flex-wrap gap-2">
                <Button type="submit">Save nested Entry</Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setNestUnder(null)}
                >
                  Cancel
                </Button>
              </div>
            </FieldGroup>
          </form>
        ) : null}

        {error ? (
          <FieldError role="alert">{error}</FieldError>
        ) : null}

        <NestedSheetTable
          rows={debts.rows}
          emptyLabel={debts.emptyLabel}
          showRemaining
          onAddChild={(entryId) => {
            setNestUnder(entryId)
            setError(null)
          }}
        />
      </section>
    </div>
  )
}
