"use client"

import type { ChangeFn } from "@automerge/automerge/slim"

import { Separator } from "@/components/ui/separator"

import type { BudgetMembershipRole } from "@/schema/budget"
import type { BudgetDoc } from "../types"
import { AccountsPanel } from "./accounts-panel"
import { BudgetSettingsPanel } from "./budget-settings-panel"
import { MembersPanel } from "./members-panel"
import { PlansPanel } from "./plans-panel"

type BudgetSettingsWorkspaceProps = {
  budgetId: string
  role: BudgetMembershipRole
  currentUserId: string
  doc: BudgetDoc
  changeDoc: (changeFn: ChangeFn<BudgetDoc>) => void
  onClose: () => void
}

function SettingsGroup({
  title,
  description,
  children,
}: {
  title: string
  description: string
  children: React.ReactNode
}) {
  return (
    <section className="flex flex-col gap-3">
      <div>
        <h2 className="text-sm font-medium">{title}</h2>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      {children}
    </section>
  )
}

export function BudgetSettingsWorkspace({
  budgetId,
  role,
  currentUserId,
  doc,
  changeDoc,
  onClose,
}: BudgetSettingsWorkspaceProps) {
  return (
    <div className="flex flex-col gap-6">
      <SettingsGroup
        title="Money & categories"
        description="Bank, cash, debt, income sources, and spending categories."
      >
        <AccountsPanel doc={doc} changeDoc={changeDoc} />
      </SettingsGroup>

      <Separator />

      <SettingsGroup
        title="People"
        description="Who can view and edit this shared budget."
      >
        <MembersPanel
          budgetId={budgetId}
          role={role}
          currentUserId={currentUserId}
        />
      </SettingsGroup>

      <Separator />

      <SettingsGroup
        title="Advanced data"
        description="Inspect and repair recurring primitives and templates."
      >
        <PlansPanel doc={doc} changeDoc={changeDoc} />
      </SettingsGroup>

      <Separator />

      <SettingsGroup
        title="Budget"
        description="Shared name, timezone, currency, and archive controls."
      >
        <BudgetSettingsPanel
          budgetId={budgetId}
          role={role}
          doc={doc}
          open
          onOpenChange={(open) => {
            if (!open) onClose()
          }}
          onRenameLocal={(name) => {
            changeDoc((draft) => {
              draft.name = name
            })
          }}
        />
      </SettingsGroup>
    </div>
  )
}
