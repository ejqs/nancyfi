"use client"

import { useEffect, useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import type { AutomergeUrl } from "@automerge/automerge-repo/slim"
import { useDocument } from "@automerge/automerge-repo-react-hooks"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

import { archiveBudgetAction, renameBudgetAction } from "../actions"
import type { BudgetMembershipRole } from "../db/schema"
import {
  budgetDocNeedsShapeFix,
  ensureBudgetDocShape,
} from "../mutations"
import type { BudgetDoc } from "../types"
import { AccountsPanel } from "./accounts-panel"
import { EntriesPanel } from "./entries-panel"
import { MembersPanel } from "./members-panel"
import { PlansPanel } from "./plans-panel"

type BudgetWorkspaceProps = {
  budgetId: string
  automergeUrl: AutomergeUrl | string
  role: BudgetMembershipRole
  catalogName: string
  currentUserId: string
}

export function BudgetWorkspace({
  budgetId,
  automergeUrl,
  role,
  catalogName,
  currentUserId,
}: BudgetWorkspaceProps) {
  const router = useRouter()
  const [doc, changeDoc] = useDocument<BudgetDoc>(
    automergeUrl as AutomergeUrl,
    { suspense: false },
  )
  const [nameDraft, setNameDraft] = useState(catalogName)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const [archived, setArchived] = useState(false)

  useEffect(() => {
    if (doc?.name) setNameDraft(doc.name)
  }, [doc?.name])

  // Backfill maps missing on docs created before newer schema fields.
  useEffect(() => {
    if (!doc || !budgetDocNeedsShapeFix(doc)) return
    changeDoc((draft) => {
      ensureBudgetDocShape(draft)
    })
  }, [doc, changeDoc])

  function handleRename(event: React.FormEvent) {
    event.preventDefault()
    const trimmed = nameDraft.trim()
    if (!trimmed) {
      setError("Name is required")
      return
    }
    setError(null)

    startTransition(async () => {
      if (doc) {
        changeDoc((draft) => {
          draft.name = trimmed
        })
      }
      const result = await renameBudgetAction({
        budgetId,
        name: trimmed,
      })
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
        "Archive this budget? It will leave your active list. Local CRDT data is kept.",
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
      setArchived(true)
      router.push("/")
      router.refresh()
    })
  }

  if (archived) {
    return (
      <p className="text-sm text-muted-foreground">Budget archived. Returning…</p>
    )
  }

  if (!doc) {
    return <p className="text-sm text-muted-foreground">Loading budget document…</p>
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button
          variant="ghost"
          size="sm"
          render={<Link href="/" />}
          nativeButton={false}
        >
          ← Budgets
        </Button>
        <p className="text-xs text-muted-foreground capitalize">Role: {role}</p>
      </div>

      <form onSubmit={handleRename} className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex flex-1 flex-col gap-1.5">
          <Label htmlFor="budget-name">Budget name</Label>
          <Input
            id="budget-name"
            value={nameDraft}
            onChange={(e) => setNameDraft(e.target.value)}
            disabled={pending}
            autoComplete="off"
          />
        </div>
        <Button type="submit" disabled={pending || nameDraft.trim() === doc.name}>
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
        <div className="sm:col-span-2">
          <dt className="font-medium text-foreground">Document</dt>
          <dd className="break-all">{String(automergeUrl)}</dd>
        </div>
      </dl>

      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      <AccountsPanel doc={doc} changeDoc={changeDoc} />
      <PlansPanel doc={doc} changeDoc={changeDoc} />
      <EntriesPanel doc={doc} changeDoc={changeDoc} />

      <MembersPanel
        budgetId={budgetId}
        role={role}
        currentUserId={currentUserId}
      />

      {role === "owner" ? (
        <div className="border-t border-border pt-4">
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
            Archives on the control plane (owner only). CRDT content is not
            deleted — safe for offline peers.
          </p>
        </div>
      ) : null}
    </div>
  )
}
