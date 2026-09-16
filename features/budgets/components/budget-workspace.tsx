"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import type { AutomergeUrl } from "@automerge/automerge-repo/slim"
import { useDocument, useRepo } from "@automerge/automerge-repo-react-hooks"

import { Button } from "@/components/ui/button"

import type { BudgetMembershipRole } from "../db/schema"
import { getAutomergeSyncUrl } from "../repo/create-browser-repo"
import { nudgeDocToSyncServer } from "../repo/nudge-remote-sync"
import {
  budgetDocNeedsShapeFix,
  ensureBudgetDocShape,
} from "../mutations"
import type { BudgetDoc } from "../types"
import { BudgetSettingsWorkspace } from "./budget-settings-workspace"
import { OverviewPanel } from "./overview-panel"
import { RecurringPanel } from "./recurring-panel"
import { PaydayBoard } from "./scenario-boards"
import {
  WORKSPACE_SECTIONS,
  type WorkspaceSection,
} from "./section-tabs"
import { TransactionsPanel } from "./transactions-panel"

/** Local IndexedDB is fast; remote sync may need longer before giving up. */
const LOCAL_FIND_TIMEOUT_MS = 4_000
const SYNC_FIND_TIMEOUT_MS = 30_000

function withDeadline<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = window.setTimeout(() => {
      reject(new Error(`TimeoutError: timed out after ${ms}ms`))
    }, ms)
    promise.then(
      (value) => {
        window.clearTimeout(timer)
        resolve(value)
      },
      (err) => {
        window.clearTimeout(timer)
        reject(err)
      },
    )
  })
}

type BudgetWorkspaceProps = {
  budgetId: string
  automergeUrl: AutomergeUrl | string
  role: BudgetMembershipRole
  catalogName: string
  currentUserId: string
  onSectionChange?: (section: WorkspaceSection) => void
  section?: WorkspaceSection
}

export function BudgetWorkspace({
  budgetId,
  automergeUrl,
  role,
  catalogName,
  currentUserId,
  onSectionChange,
  section: controlledSection,
}: BudgetWorkspaceProps) {
  const repo = useRepo()
  const syncConfigured = Boolean(getAutomergeSyncUrl())
  const [doc, changeDoc] = useDocument<BudgetDoc>(
    automergeUrl as AutomergeUrl,
    { suspense: false },
  )
  const [internalSection, setInternalSection] =
    useState<WorkspaceSection>("home")
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [transactionDialogOpen, setTransactionDialogOpen] = useState(false)
  const [missingOnDevice, setMissingOnDevice] = useState(false)

  const section = controlledSection ?? internalSection

  function setSection(next: WorkspaceSection) {
    if (controlledSection === undefined) setInternalSection(next)
    onSectionChange?.(next)
  }

  useEffect(() => {
    if (doc) return

    let cancelled = false
    const timeoutMs = syncConfigured
      ? SYNC_FIND_TIMEOUT_MS
      : LOCAL_FIND_TIMEOUT_MS

    async function probeFind() {
      try {
        await withDeadline(repo.find(automergeUrl as AutomergeUrl), timeoutMs)
      } catch {
        if (!cancelled) setMissingOnDevice(true)
      }
    }

    void probeFind()
    return () => {
      cancelled = true
    }
  }, [doc, repo, automergeUrl, syncConfigured])

  useEffect(() => {
    if (!doc || !budgetDocNeedsShapeFix(doc)) return
    changeDoc((draft) => {
      ensureBudgetDocShape(draft)
    })
  }, [doc, changeDoc])

  // Existing IndexedDB docs often load before the WebSocket peer is ready.
  // An empty change dirties sync and pushes the full doc to the sync server.
  useEffect(() => {
    if (!doc || !syncConfigured) return
    void nudgeDocToSyncServer(repo, automergeUrl as AutomergeUrl).catch(
      () => undefined,
    )
  }, [doc, repo, automergeUrl, syncConfigured])

  useEffect(() => {
    const timer = window.setTimeout(() => setSettingsOpen(false), 0)
    return () => window.clearTimeout(timer)
  }, [controlledSection])

  if (!doc) {
    if (missingOnDevice) {
      return (
        <div className="flex max-w-md flex-col gap-3" role="alert">
          <div>
            <p className="text-sm font-medium text-foreground">
              This budget isn’t on this device yet
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {syncConfigured
                ? "On the device that already has this budget, open it and wait until Synced, then tap Try again here. New budgets sync automatically; older ones need that one-time open."
                : "Budget data stays in the browser where it was created until sync is configured (NEXT_PUBLIC_AUTOMERGE_SYNC_URL)."}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button render={<Link href="/" />} size="sm">
              Back to budgets
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => {
                setMissingOnDevice(false)
                window.location.reload()
              }}
            >
              Try again
            </Button>
          </div>
        </div>
      )
    }

    return (
      <p className="text-sm text-muted-foreground">
        {syncConfigured ? "Opening budget (syncing)…" : "Opening budget…"}
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground capitalize">
          {role === "owner" ? "Owner" : "Contributor"}
          {catalogName ? ` · ${doc.defaultCurrency}` : ""}
        </p>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setSettingsOpen((open) => !open)}
        >
          {settingsOpen ? "Close settings" : "Settings"}
        </Button>
      </div>

      {settingsOpen ? (
        <BudgetSettingsWorkspace
          budgetId={budgetId}
          role={role}
          currentUserId={currentUserId}
          doc={doc}
          changeDoc={changeDoc}
          onClose={() => setSettingsOpen(false)}
        />
      ) : null}

      {!settingsOpen && section === "home" ? (
        <OverviewPanel
          doc={doc}
          onNavigate={setSection}
          onAddTransaction={() => {
            setTransactionDialogOpen(true)
            setSection("transactions")
          }}
          onOpenSettings={() => setSettingsOpen(true)}
        />
      ) : null}
      {!settingsOpen && section === "recurring" ? (
        <RecurringPanel doc={doc} changeDoc={changeDoc} />
      ) : null}
      {!settingsOpen && section === "transactions" ? (
        <TransactionsPanel
          doc={doc}
          changeDoc={changeDoc}
          openCreate={transactionDialogOpen}
          onCreateOpenChange={setTransactionDialogOpen}
        />
      ) : null}
      {!settingsOpen && section === "payday" ? (
        <PaydayBoard
          doc={doc}
          changeDoc={changeDoc}
          onOpenRecurring={() => setSection("recurring")}
        />
      ) : null}
    </div>
  )
}

export { WORKSPACE_SECTIONS }
export type { WorkspaceSection }
