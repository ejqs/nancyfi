"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

import { archiveBudgetAction, renameBudgetAction } from "../actions"
import type { BudgetMembershipRole } from "../db/schema"
import type { BudgetDoc } from "../types"

type BudgetSettingsPanelProps = {
  budgetId: string
  role: BudgetMembershipRole
  doc: BudgetDoc
  onRenameLocal: (name: string) => void
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function BudgetSettingsPanel({
  budgetId,
  role,
  doc,
  onRenameLocal,
  open,
  onOpenChange,
}: BudgetSettingsPanelProps) {
  if (!open) return null

  return (
    <BudgetSettingsForm
      key={doc.name}
      budgetId={budgetId}
      role={role}
      doc={doc}
      onRenameLocal={onRenameLocal}
      onOpenChange={onOpenChange}
    />
  )
}

function BudgetSettingsForm({
  budgetId,
  role,
  doc,
  onRenameLocal,
  onOpenChange,
}: Omit<BudgetSettingsPanelProps, "open">) {
  const router = useRouter()
  const [nameDraft, setNameDraft] = useState(doc.name)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function handleRename(event: React.FormEvent) {
    event.preventDefault()
    const trimmed = nameDraft.trim()
    if (!trimmed) {
      setError("Name is required")
      return
    }
    setError(null)
    startTransition(async () => {
      onRenameLocal(trimmed)
      const result = await renameBudgetAction({ budgetId, name: trimmed })
      if (!result.ok) {
        setError(result.error)
        return
      }
      setNameDraft(result.data.name)
    })
  }

  function handleArchive() {
    if (role !== "owner") return
    if (
      !window.confirm(
        "Archive this budget? It will leave your active list. Local data stays on this device.",
      )
    ) {
      return
    }
    setError(null)
    startTransition(async () => {
      const result = await archiveBudgetAction({ budgetId })
      if (!result.ok) {
        setError(result.error)
        return
      }
      onOpenChange(false)
      router.push("/")
      router.refresh()
    })
  }

  return (
    <section className="flex flex-col gap-4 rounded-md border border-border p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="text-sm font-medium">Budget settings</h2>
          <p className="text-xs text-muted-foreground">
            Name, timezone, and archive.
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => onOpenChange(false)}
        >
          Close
        </Button>
      </div>

      <form
        onSubmit={handleRename}
        className="flex flex-col gap-3 sm:flex-row sm:items-end"
      >
        <div className="flex flex-1 flex-col gap-1.5">
          <Label htmlFor="budget-settings-name">Budget name</Label>
          <Input
            id="budget-settings-name"
            value={nameDraft}
            onChange={(e) => setNameDraft(e.target.value)}
            disabled={pending}
            autoComplete="off"
          />
        </div>
        <Button
          type="submit"
          disabled={pending || nameDraft.trim() === doc.name}
        >
          Save name
        </Button>
      </form>

      <dl className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
        <div>
          <dt className="font-medium text-foreground">Timezone</dt>
          <dd>{doc.timezone}</dd>
        </div>
        <div>
          <dt className="font-medium text-foreground">Default currency</dt>
          <dd>{doc.defaultCurrency}</dd>
        </div>
      </dl>

      {role === "owner" ? (
        <div className="border-t border-border pt-3">
          <Button
            type="button"
            variant="destructive"
            size="sm"
            disabled={pending}
            onClick={handleArchive}
          >
            Archive budget
          </Button>
          <p className="mt-2 text-xs text-muted-foreground">
            Removes it from your active list. Offline copies on other devices are
            kept.
          </p>
        </div>
      ) : null}

      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  )
}
