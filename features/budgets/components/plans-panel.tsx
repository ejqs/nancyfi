"use client"

import { useState } from "react"
import type { ChangeFn } from "@automerge/automerge/slim"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

import { applySeedCatalogPlanTemplates } from "../catalog-plan-templates"
import { money } from "../document"
import { formatMinor, parseMajorToMinor } from "../money-format"
import {
  applyCancelPlan,
  applyCreatePlanFromTemplate,
  applyDeletePlanTemplate,
  applyUpsertPlan,
  applyUpsertPlanTemplate,
} from "../mutations"
import { applyProposePlanOccurrences } from "../plan-propose"
import { createPaydaySchedule } from "../schedule"
import type {
  AmountOrFormula,
  BudgetDoc,
  Plan,
  PlanKind,
  PlanStatus,
  PlanTemplate,
  Schedule,
} from "../types"
import {
  ListRow,
  RowActions,
  RowMeta,
  RowTitle,
  StatusDot,
} from "./list-row"

const PLAN_KINDS: PlanKind[] = [
  "income",
  "allocation",
  "subscription",
  "repayment",
  "other",
]

const PLAN_STATUSES: PlanStatus[] = [
  "active",
  "paused",
  "cancelled",
  "completed",
]

const selectClassName =
  "h-7 w-full min-w-0 rounded-md border border-input bg-input/20 px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30 disabled:opacity-50 dark:bg-input/30"

type PlansPanelProps = {
  doc: BudgetDoc
  changeDoc: (changeFn: ChangeFn<BudgetDoc>) => void
}

function formulaLabel(formula: AmountOrFormula): string {
  if (formula.type === "fixed") {
    return formatMinor(formula.money.amountMinor, formula.money.currency)
  }
  if (formula.type === "percent") {
    return `${(formula.percentBps / 100).toFixed(2)}%`
  }
  if (formula.type === "remainingBalance") {
    return `remaining of ${formula.ofAccountId.slice(0, 8)}…`
  }
  return `extension:${formula.key}`
}

function sortPlans(plans: Plan[]): Plan[] {
  return [...plans].sort((a, b) => a.name.localeCompare(b.name))
}

function sortTemplates(templates: PlanTemplate[]): PlanTemplate[] {
  return [...templates].sort((a, b) => a.name.localeCompare(b.name))
}

function monthRangeAroundToday(): { from: string; to: string } {
  const now = new Date()
  const y = now.getFullYear()
  const m = now.getMonth()
  const from = `${y}-${String(m + 1).padStart(2, "0")}-01`
  const end = new Date(y, m + 2, 0)
  const to = `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, "0")}-${String(end.getDate()).padStart(2, "0")}`
  return { from, to }
}

export function PlansPanel({ doc, changeDoc }: PlansPanelProps) {
  const plans = sortPlans(Object.values(doc.plansById ?? {}))
  const templates = sortTemplates(Object.values(doc.planTemplatesById ?? {}))
  const activeAccounts = Object.values(doc.accountsById ?? {})
    .filter((a) => a.status === "active")
    .sort((a, b) => a.name.localeCompare(b.name))

  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [showPlanForm, setShowPlanForm] = useState(false)
  const [showTemplates, setShowTemplates] = useState(false)

  // Plan form
  const [editingPlanId, setEditingPlanId] = useState<string | null>(null)
  const [planName, setPlanName] = useState("")
  const [planKind, setPlanKind] = useState<PlanKind>("income")
  const [planStatus, setPlanStatus] = useState<PlanStatus>("active")
  const [planAmount, setPlanAmount] = useState("")
  const [fromAccountId, setFromAccountId] = useState("")
  const [toAccountId, setToAccountId] = useState("")
  const [templateId, setTemplateId] = useState("")
  const [usePaydaySchedule, setUsePaydaySchedule] = useState(true)
  const [occurrenceCount, setOccurrenceCount] = useState("")

  // Template form
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null)
  const [templateName, setTemplateName] = useState("")
  const [templateKind, setTemplateKind] = useState<PlanKind>("repayment")
  const [templateLabels, setTemplateLabels] = useState("")
  const [templateAmount, setTemplateAmount] = useState("")

  function resetPlanForm() {
    setEditingPlanId(null)
    setPlanName("")
    setPlanKind("income")
    setPlanStatus("active")
    setPlanAmount("")
    setFromAccountId("")
    setToAccountId("")
    setTemplateId("")
    setUsePaydaySchedule(true)
    setOccurrenceCount("")
    setError(null)
    setShowPlanForm(false)
  }

  function resetTemplateForm() {
    setEditingTemplateId(null)
    setTemplateName("")
    setTemplateKind("repayment")
    setTemplateLabels("")
    setTemplateAmount("")
    setError(null)
  }

  function startEditPlan(plan: Plan) {
    setEditingPlanId(plan.id)
    setPlanName(plan.name)
    setPlanKind(plan.kind)
    setPlanStatus(plan.status)
    setTemplateId(plan.templateId ?? "")
    setFromAccountId(plan.linkedAccountIds[0] ?? "")
    setToAccountId(plan.linkedAccountIds[1] ?? "")
    setUsePaydaySchedule(Boolean(plan.schedule))
    setOccurrenceCount(
      plan.schedule?.occurrenceCount !== undefined
        ? String(plan.schedule.occurrenceCount)
        : "",
    )
    if (plan.amountOrFormula.type === "fixed") {
      const minor = plan.amountOrFormula.money.amountMinor
      setPlanAmount(`${Math.floor(minor / 100)}.${String(minor % 100).padStart(2, "0")}`)
    } else {
      setPlanAmount("")
    }
    setError(null)
    setMessage(null)
    setShowPlanForm(true)
  }

  function startEditTemplate(template: PlanTemplate) {
    setEditingTemplateId(template.id)
    setTemplateName(template.name)
    setTemplateKind(template.kind)
    setTemplateLabels((template.labels ?? []).join(", "))
    if (template.defaultAmountOrFormula?.type === "fixed") {
      const minor = template.defaultAmountOrFormula.money.amountMinor
      setTemplateAmount(
        `${Math.floor(minor / 100)}.${String(minor % 100).padStart(2, "0")}`,
      )
    } else {
      setTemplateAmount("")
    }
    setError(null)
  }

  function buildSchedule(): Schedule | null {
    if (!usePaydaySchedule) return null
    const schedule = createPaydaySchedule({ timezone: doc.timezone })
    if (occurrenceCount.trim()) {
      const n = Number(occurrenceCount)
      if (!Number.isInteger(n) || n < 1) {
        throw new Error("Occurrence count must be a positive integer")
      }
      schedule.occurrenceCount = n
    }
    return schedule
  }

  function handleSeedCatalog() {
    try {
      let seeded = 0
      changeDoc((draft) => {
        const result = applySeedCatalogPlanTemplates(draft, {
          timezone: doc.timezone,
        })
        seeded = result.seededIds.length
      })
      setMessage(
        seeded > 0
          ? `Seeded ${seeded} catalog template(s).`
          : "Catalog templates already present.",
      )
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to seed catalog")
    }
  }

  function handleApplyTemplate(template: PlanTemplate) {
    if (activeAccounts.length < 2) {
      setError("Add at least two accounts before creating a Plan")
      return
    }
    try {
      const planId = crypto.randomUUID()
      changeDoc((draft) => {
        applyCreatePlanFromTemplate(draft, {
          planId,
          templateId: template.id,
          linkedAccountIds: [
            activeAccounts[0]?.id,
            activeAccounts[1]?.id,
          ].filter(Boolean) as string[],
        })
      })
      setMessage(`Created Plan from “${template.name}”. Link accounts as needed.`)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to apply template")
    }
  }

  function handleSavePlan(event: React.FormEvent) {
    event.preventDefault()
    const trimmed = planName.trim()
    if (!trimmed) {
      setError("Plan name is required")
      return
    }
    if (!fromAccountId || !toAccountId) {
      setError("Link from and to accounts")
      return
    }
    try {
      const amountMinor = parseMajorToMinor(planAmount)
      const schedule = buildSchedule()
      const id = editingPlanId ?? crypto.randomUUID()

      if (templateId) {
        // Create via template then overlay edits so templateId is valid
        changeDoc((draft) => {
          if (!editingPlanId && draft.planTemplatesById[templateId]) {
            applyCreatePlanFromTemplate(draft, {
              planId: id,
              templateId,
              name: trimmed,
              linkedAccountIds: [fromAccountId, toAccountId],
              amountOrFormula: {
                type: "fixed",
                money: money(amountMinor, doc.defaultCurrency),
              },
              schedule: schedule ?? undefined,
              status: planStatus,
            })
          } else {
            applyUpsertPlan(draft, {
              id,
              name: trimmed,
              kind: planKind,
              templateId: templateId || null,
              status: planStatus,
              amountOrFormula: {
                type: "fixed",
                money: money(amountMinor, doc.defaultCurrency),
              },
              schedule,
              linkedAccountIds: [fromAccountId, toAccountId],
            })
          }
        })
      } else {
        changeDoc((draft) => {
          applyUpsertPlan(draft, {
            id,
            name: trimmed,
            kind: planKind,
            templateId: null,
            status: planStatus,
            amountOrFormula: {
              type: "fixed",
              money: money(amountMinor, doc.defaultCurrency),
            },
            schedule,
            linkedAccountIds: [fromAccountId, toAccountId],
          })
        })
      }
      resetPlanForm()
      setMessage(editingPlanId ? "Plan saved." : "Plan created.")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save Plan")
    }
  }

  function handleCancelPlan(plan: Plan) {
    if (plan.status === "cancelled") return
    if (
      !window.confirm(
        `Cancel “${plan.name}”? Future occurrences stop; posted Entries and liabilities stay.`,
      )
    ) {
      return
    }
    try {
      changeDoc((draft) => {
        applyCancelPlan(draft, plan.id)
      })
      setMessage("Plan cancelled — no new proposals.")
      setError(null)
      if (editingPlanId === plan.id) resetPlanForm()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to cancel Plan")
    }
  }

  function handlePropose(plan: Plan) {
    if (plan.status !== "active") {
      setError("Only active Plans generate proposals")
      return
    }
    try {
      const range = monthRangeAroundToday()
      let created = 0
      changeDoc((draft) => {
        const result = applyProposePlanOccurrences(draft, {
          planId: plan.id,
          range,
          entryIdForOccurrence: () => crypto.randomUUID(),
        })
        created = result.createdEntryIds.length
      })
      setMessage(
        created > 0
          ? `Proposed ${created} Entr${created === 1 ? "y" : "ies"} (confirm to post).`
          : "No new occurrences in the next ~2 months (already proposed or out of range).",
      )
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to propose Entries")
    }
  }

  function handleSaveTemplate(event: React.FormEvent) {
    event.preventDefault()
    const trimmed = templateName.trim()
    if (!trimmed) {
      setError("Template name is required")
      return
    }
    try {
      const id = editingTemplateId ?? crypto.randomUUID()
      const labels = templateLabels
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
      const amountOrFormula =
        templateAmount.trim() === ""
          ? null
          : ({
              type: "fixed",
              money: money(
                parseMajorToMinor(templateAmount),
                doc.defaultCurrency,
              ),
            } satisfies AmountOrFormula)

      changeDoc((draft) => {
        applyUpsertPlanTemplate(draft, {
          id,
          name: trimmed,
          kind: templateKind,
          labels: labels.length ? labels : null,
          defaultAmountOrFormula: amountOrFormula,
          defaultSchedule: createPaydaySchedule({ timezone: doc.timezone }),
        })
      })
      resetTemplateForm()
      setMessage(editingTemplateId ? "Template saved." : "Template created.")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save template")
    }
  }

  function handleDeleteTemplate(template: PlanTemplate) {
    if (
      !window.confirm(
        `Delete template “${template.name}”? Existing Plans keep their copied fields.`,
      )
    ) {
      return
    }
    try {
      changeDoc((draft) => {
        applyDeletePlanTemplate(draft, template.id)
      })
      if (editingTemplateId === template.id) resetTemplateForm()
      setMessage("Template deleted.")
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete template")
    }
  }

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-sm font-medium text-foreground">Plans</h2>
          <p className="text-xs text-muted-foreground">
            Recurring income, subscriptions, and repayments. Proposals stay
            unconfirmed until you post them in Activity.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            onClick={() => {
              resetPlanForm()
              setShowPlanForm(true)
            }}
          >
            + Plan
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setShowTemplates((open) => !open)}
          >
            {showTemplates ? "Hide templates" : "Templates"}
          </Button>
        </div>
      </div>

      {message ? (
        <p className="text-xs text-muted-foreground" role="status">
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      {showTemplates ? (
      <div className="flex flex-col gap-3 rounded-md border border-border p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-medium text-foreground">Plan templates</p>
          <Button type="button" variant="ghost" size="sm" onClick={handleSeedCatalog}>
            Seed starter templates
          </Button>
        </div>
        <form onSubmit={handleSaveTemplate} className="flex flex-col gap-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="template-name">Name</Label>
              <Input
                id="template-name"
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                placeholder="Installment (24 mo)…"
                autoComplete="off"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="template-kind">Type</Label>
              <select
                id="template-kind"
                className={selectClassName}
                value={templateKind}
                onChange={(e) => setTemplateKind(e.target.value as PlanKind)}
              >
                {PLAN_KINDS.map((k) => (
                  <option key={k} value={k}>
                    {k}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="template-amount">
                Default amount ({doc.defaultCurrency}, optional)
              </Label>
              <Input
                id="template-amount"
                inputMode="decimal"
                value={templateAmount}
                onChange={(e) => setTemplateAmount(e.target.value)}
                placeholder="2000.00"
                autoComplete="off"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="template-labels">Labels (comma-separated)</Label>
              <Input
                id="template-labels"
                value={templateLabels}
                onChange={(e) => setTemplateLabels(e.target.value)}
                placeholder="installment, 24-mo"
                autoComplete="off"
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="submit">
              {editingTemplateId ? "Save template" : "Add template"}
            </Button>
            {editingTemplateId ? (
              <Button type="button" variant="ghost" onClick={resetTemplateForm}>
                Cancel
              </Button>
            ) : null}
          </div>
        </form>

        {templates.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            No templates yet. Seed the catalog or add one.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {templates.map((template) => (
              <li
                key={template.id}
                className="flex flex-wrap items-start justify-between gap-2 rounded-md border border-border px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="text-sm text-foreground">
                    {template.name}
                    <span className="ml-2 text-xs text-muted-foreground">
                      {template.kind}
                    </span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {(template.labels ?? []).join(" · ") || "no labels"}
                    {template.defaultAmountOrFormula
                      ? ` · ${formulaLabel(template.defaultAmountOrFormula)}`
                      : ""}
                  </p>
                </div>
                <div className="flex gap-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleApplyTemplate(template)}
                  >
                    Use
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => startEditTemplate(template)}
                  >
                    Edit
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteTemplate(template)}
                  >
                    Delete
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
      ) : null}

      {showPlanForm ? (
      <form
        onSubmit={handleSavePlan}
        className="flex flex-col gap-3 rounded-md border border-border p-3"
      >
        <p className="text-xs font-medium text-foreground">
          {editingPlanId ? "Edit plan" : "New plan"}
        </p>
        {activeAccounts.length < 2 ? (
          <p className="text-xs text-muted-foreground">
            Add at least two accounts before creating a Plan.
          </p>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5 sm:col-span-2">
                <Label htmlFor="plan-name">Name</Label>
                <Input
                  id="plan-name"
                  value={planName}
                  onChange={(e) => setPlanName(e.target.value)}
                  placeholder="Semi-monthly salary…"
                  autoComplete="off"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="plan-kind">Type</Label>
                <select
                  id="plan-kind"
                  className={selectClassName}
                  value={planKind}
                  onChange={(e) => setPlanKind(e.target.value as PlanKind)}
                >
                  {PLAN_KINDS.map((k) => (
                    <option key={k} value={k}>
                      {k}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="plan-status">Status</Label>
                <select
                  id="plan-status"
                  className={selectClassName}
                  value={planStatus}
                  onChange={(e) => setPlanStatus(e.target.value as PlanStatus)}
                >
                  {PLAN_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="plan-amount">
                  Typical amount ({doc.defaultCurrency})
                </Label>
                <Input
                  id="plan-amount"
                  inputMode="decimal"
                  value={planAmount}
                  onChange={(e) => setPlanAmount(e.target.value)}
                  placeholder="50000.00"
                  autoComplete="off"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="plan-template">Template (optional)</Label>
                <select
                  id="plan-template"
                  className={selectClassName}
                  value={templateId}
                  onChange={(e) => {
                    setTemplateId(e.target.value)
                    const t = doc.planTemplatesById?.[e.target.value]
                    if (t) {
                      setPlanKind(t.kind)
                      if (!planName) setPlanName(t.name)
                    }
                  }}
                >
                  <option value="">None</option>
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                      {t.labels?.length ? ` (${t.labels.join(", ")})` : ""}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="plan-from">From account</Label>
                <select
                  id="plan-from"
                  className={selectClassName}
                  value={fromAccountId}
                  onChange={(e) => setFromAccountId(e.target.value)}
                >
                  <option value="">Select…</option>
                  {activeAccounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} ({a.kind})
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="plan-to">To account</Label>
                <select
                  id="plan-to"
                  className={selectClassName}
                  value={toAccountId}
                  onChange={(e) => setToAccountId(e.target.value)}
                >
                  <option value="">Select…</option>
                  {activeAccounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} ({a.kind})
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1.5 sm:col-span-2">
                <label className="flex items-center gap-2 text-sm text-foreground">
                  <input
                    type="checkbox"
                    checked={usePaydaySchedule}
                    onChange={(e) => setUsePaydaySchedule(e.target.checked)}
                  />
                  Payday schedule (15th + EOM, previous weekday)
                </label>
              </div>
              {usePaydaySchedule ? (
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="plan-occs">Occurrence count (optional)</Label>
                  <Input
                    id="plan-occs"
                    inputMode="numeric"
                    value={occurrenceCount}
                    onChange={(e) => setOccurrenceCount(e.target.value)}
                    placeholder="e.g. 24 for installments"
                    autoComplete="off"
                  />
                </div>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="submit">
                {editingPlanId ? "Save plan" : "Add plan"}
              </Button>
              <Button type="button" variant="ghost" onClick={resetPlanForm}>
                Cancel
              </Button>
            </div>
          </>
        )}
      </form>
      ) : null}

      {plans.length === 0 ? (
        <p className="text-xs text-muted-foreground">No plans yet.</p>
      ) : (
        <div className="rounded-md border border-border/80">
          {plans.map((plan) => {
            const template = plan.templateId
              ? doc.planTemplatesById?.[plan.templateId]
              : undefined
            const from = plan.linkedAccountIds[0]
              ? doc.accountsById?.[plan.linkedAccountIds[0]]?.name
              : null
            const to = plan.linkedAccountIds[1]
              ? doc.accountsById[plan.linkedAccountIds[1]]?.name
              : null
            return (
              <ListRow key={plan.id}>
                <StatusDot
                  tone={plan.status === "active" ? "active" : "muted"}
                  label={plan.status}
                />
                <RowTitle>{plan.name}</RowTitle>
                <RowMeta>
                  {plan.kind}
                  {template ? ` · ${template.name}` : ""}
                  {` · ${formulaLabel(plan.amountOrFormula)}`}
                  {from && to ? ` · ${from} → ${to}` : ""}
                </RowMeta>
                <RowActions>
                  {plan.status === "active" ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handlePropose(plan)}
                    >
                      Propose
                    </Button>
                  ) : null}
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => startEditPlan(plan)}
                  >
                    Edit
                  </Button>
                  {plan.status !== "cancelled" ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleCancelPlan(plan)}
                    >
                      Cancel
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
