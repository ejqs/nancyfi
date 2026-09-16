# Budgets — data model

Domain shape for a single **Budget** Automerge document.

System index: [docs/architecture/data-model.md](../../../docs/architecture/data-model.md).  
Rules: [features/rules/docs](../../rules/docs/README.md).  
Membership: [multiplayer](../../../docs/architecture/multiplayer.md) (control plane).

## Overview

```text
Budget
  accountsById
  entriesById
  plansById
  planTemplatesById
  rulesAppliedById
  ruleRunsById

Account
  id, name, kind, parentId?

Entry
  id, description, effectiveAt, status
  postings[] { accountId, money, role? }
  sourcePlanOccurrenceId?

Plan
  id, name, kind, templateId?, status
  amountOrFormula, schedule
  linkedAccountIds, occurrenceIds

PlanTemplate
  id, name, kind, defaults…

Money
  amountMinor, currency
```

## Budget

Prefer one Automerge document per budget ([modeling guidance](https://automerge.org/docs/cookbook/modeling-data/)).

| Field | Type | Notes |
| --- | --- | --- |
| `id` / doc URL | string | Document identity |
| `name` | string | Display name |
| `timezone` | string | Used by schedules |
| `defaultCurrency` | string | ISO 4217 |
| `accountsById` | map | Financial containers and category hierarchy |
| `entriesById` | map | Proposed and posted facts |
| `plansById` | map | Future intent and commitments |
| `planTemplatesById` | map | User/household Plan recipes (catalog may copy in) |
| `rulesAppliedById` | map | Enabled automation |
| `ruleRunsById` | map | Idempotency and audit records |

Member roles (`owner` / `contributor`) remain authoritative on the control plane.

## Account

An Account is a typed container. Hierarchical income/expense accounts can represent categories and groups such as Needs, Wants, and Savings without adding a separate Category primitive.

| Field | Type | Notes |
| --- | --- | --- |
| `id` | string | Stable ID |
| `name` | string | e.g. Checking, Mom, Subscriptions |
| `kind` | `asset` \| `liability` \| `income` \| `expense` | Accounting behavior |
| `parentId` | string? | Optional hierarchy |
| `currency` | string? | Restrict an account when required |
| `status` | `active` \| `archived` | Preserve history |

Entries reference Accounts through postings; Accounts do not own mutable `entries[]` arrays.

## Entry

An Entry is a proposed or posted financial event.

| Field | Type | Notes |
| --- | --- | --- |
| `id` | string | Stable ID |
| `description` | string | Human label |
| `effectiveAt` | timestamp | Financial date |
| `status` | `proposed` \| `posted` \| `void` | Posted history is not deleted |
| `postings` | Posting[] | Explicit financial effects |
| `sourcePlanOccurrenceId` | string? | Explains which Plan occurrence generated it |

### Posting

| Field | Type | Notes |
| --- | --- | --- |
| `accountId` | string | Account receiving the effect |
| `money` | Money | Signed value (**+ = debit, − = credit**) |
| `role` | string? | e.g. `principal`, `payment`, `expense`, `allocation`, `adjustment` |

**Sign convention (NAN-19):** positive `amountMinor` is a debit; negative is a credit. Assets and expenses increase with debits; liabilities and income increase with credits. Posted Entries balance per currency (sum of signed amounts = 0 per currency). The UI can present a simple from/to amount form and generate the balancing posting internally (`buildBalancingPostings`).

**Reset to zero ([NAN-34](https://linear.app/nancyfi/issue/NAN-34/reset-account-balance-to-zero)):** `applyResetAccountBalance` posts one balanced Entry with posting `role: adjustment` so the Account’s signed posted balance becomes 0. Prior Entries stay posted. When no offset Account is supplied, a shared expense Account named **Balance adjustments** is created or reused.

This replaces positional `amounts[]`: ordering is unsafe under concurrent insertion, and a raw amount does not explain whether it is a charge, payment, allocation, or adjustment.

## Plan

A Plan is stored future intent. The **kernel** uses a small set of mechanical kinds; users (and catalog recipes) set up familiar labels like “24-mo installment” or “owe Mom” as **Plan templates** — not separate ledger kinds.

### Kernel `kind`

| Value | Mechanical meaning |
| --- | --- |
| `income` | Expected inflow (e.g. salary) |
| `allocation` | Reserve / split policy (fixed or %) |
| `subscription` | Recurring service charge (service cadence) |
| `repayment` | Pay down a liability over time (fixed term **or** open-ended) |
| `other` | Escape hatch with inspectable fields still on the Plan |

**Resolved:** do **not** ship both `installment` and `obligation` as kernel kinds. Both are `repayment`; the difference is template defaults and Plan fields (`occurrenceCount` vs `remainingBalance`, linked liability, labels) — user-configured setups.

### Plan fields

| Field | Type | Notes |
| --- | --- | --- |
| `id` | string | Stable ID |
| `name` | string | Human label (may come from a template) |
| `kind` | kernel kind above | Branching for Rules/UI defaults — not marketing copy |
| `templateId` | string? | Optional Plan template that seeded this Plan |
| `status` | `active` \| `paused` \| `cancelled` \| `completed` | Lifecycle |
| `amountOrFormula` | object | Fixed money, percentage, remaining balance, or extension |
| `schedule` | Schedule? | Recurrence and business-day adjustment |
| `linkedAccountIds` | string[] | Income, expense, liability, and settlement accounts |
| `occurrenceIds` | string[] | Generated proposal/run references |

### Plan template (user / catalog setup)

A **Plan template** is a named recipe: label, icon, default `kind`, default `amountOrFormula` / `schedule`, suggested linked account roles, DisplayProfile hints. Examples:

- “Installment purchase (24 mo)” → `kind: repayment`, `occurrenceCount: 24`
- “Debt to Mom” → `kind: repayment`, formula `remainingBalance` or fixed payday amount
- “Salary (semi-monthly)” → `kind: income`, anchors 15 + EOM

Templates may live on the budget (`planTemplatesById`) and/or in a shareable catalog (same visibility idea as Rules / Lenses). Creating a Plan from a template copies defaults into inspectable Plan data — **not** a pointer that must execute custom code to know the terms.

Plans generate **proposed** Entries via `applyProposePlanOccurrences` (schedule expand → balanced postings; status stays `proposed` until confirm). **Default (NAN-19):** proposals stay `proposed` until the user confirms; opt-in auto-post per Plan/Rule is later. Cancelling a Plan (`applyCancelPlan`) stops future occurrences but never deletes posted history or an outstanding liability.

### Why Plan is separate from Rule

- **Plan:** what should happen
- **Rule:** when and how to react
- **Entry:** what concretely happened or is proposed
- **Account:** where the financial effect lands

Example: a Plan records “pay Mom a fixed amount twice monthly until August 2028.” A Rule reacts on payday and creates the next proposed Entry. Posted Entries reduce the liability, so remaining debt is derived.

If those terms exist only inside JavaScript, Nancyfi cannot show upcoming payments, explain generated Entries, calculate remaining debt, or cancel safely without executing arbitrary code. Rules would become an **uninspectable second database**.

## Schedule

A Schedule supports:

- anchors such as the 15th and end of month;
- adjustment to the previous weekday;
- timezone;
- start/end dates or an occurrence count.

### Engine (`features/budgets/schedule.ts`)

| Concern | Behavior |
| --- | --- |
| Anchors | `dayOfMonth` (requires `dayOfMonth` 1–31) and/or `endOfMonth` |
| Invalid day | If `dayOfMonth` does not exist in a month (e.g. 31 in February), that month’s day-of-month occurrence is **skipped** (no clamp onto EOM) |
| Weekday adjust | When `adjustToPreviousWeekday`, Saturday → Friday, Sunday → Friday |
| Bounds | `startAt` / `endAt` (YYYY-MM-DD or ISO datetime → calendar date in `timezone`) and/or `occurrenceCount`; expand also accepts a range |
| Occurrence id | `${nominalDate}:${anchor}` (e.g. `2026-09-15:dayOfMonth`) — keyed on the **nominal** anchor date so weekend moves do not change the id |
| Payday helper | `createPaydaySchedule({ timezone, dayOfMonth?: 15 })` → anchors `dayOfMonth` + `endOfMonth` with weekday adjust |

**Policy (NAN-19):** adjust for weekends **and Philippine holidays**. **Implemented today:** weekends only. Holiday calendars (and later pluggable calendars / rules marketplace) are follow-on work and do not block weekend adjustment.

## Money and foreign exchange

```text
Money {
  amountMinor: integer
  currency: ISO-4217 string
}
```

Never use floating-point money. Represent exchange rates as decimal strings or rational values. A multi-currency Entry records explicit conversion metadata and balancing postings.

**FX policy (NAN-19):** seed the rate at **purchase-time**; allow the user to apply **small corrective adjustments** later (do not force payment-time revaluation as the default).

## Spreadsheet scenarios

The full design goal and acceptance invariants live in [Scenario: payday, subscriptions, and debt reimbursement](../../../docs/scenarios/payday-subscriptions-and-debt.md).

### Payday and allocations

A salary Plan uses semi-monthly anchors (`15`, `endOfMonth`) adjusted to the previous weekday. Allocation Plans use fixed or percentage formulas targeting income/expense/savings Accounts.

**Variable actual salary:** the payday RuleRun still records that the occurrence ran. The generated salary Entry stays `proposed` until confirmed so the owner can edit the amount (overtime, absences) without changing the Plan’s typical expectation. Percentage allocations recalculate from the **actual** proposed/posted salary Entry. See [scenario: variable actual salary](../../../docs/scenarios/payday-subscriptions-and-debt.md#variable-actual-salary-resolved).

### Subscriptions and repayments

A `subscription` Plan records the service cadence and price. Settlement may use another Plan (`repayment`) or schedule: half per payday, 1/12 of an annual purchase, or 24 fixed installments — typically from a user/catalog **template**, still `kind: repayment`.

### Debt and cancellation

An annual purchase can increase a liability Account and create a `repayment` Plan (e.g. from an “owe Mom” or “installment” template). Each posted payment reduces that liability. Cancelling the service Plan stops future service occurrences; the liability and repayment Plan remain until settled.

Subscription and debt screens are derived views (**Lenses**). An item can disappear from subscriptions while remaining in debt without moving or duplicating records. Budgets may pin household default Lenses; each member can override with personal Lenses. See [Lenses and personalization](../../../docs/architecture/lenses-and-personalization.md).

## Automerge notes

- Store entities in maps keyed by stable IDs.
- Lists contain IDs only where user-defined order matters.
- Rule/Plan occurrences use deterministic IDs to prevent duplicate execution across offline devices.
- Initialize schema once and share ancestry; see [Modeling Data](https://automerge.org/docs/cookbook/modeling-data/).

## Open decisions

- Archive/delete behavior under CRDT tombstones
- Holiday calendar implementation (policy resolved: weekends + PH holidays; engine still weekends-only)
- Opt-in auto-post per Plan/Rule (default remains confirm-to-post)
- Pluggable calendars / rules marketplace (future)

## Resolved policy ([NAN-19](https://linear.app/nancyfi/issue/NAN-19/decide-open-money-schedule-fx-policies))

- Annual 1/12 settlement cadence: customizable; scenario default = split across both paydays
- Holiday target: weekends + PH holidays (engine: weekends only until calendars land)
- Auto-post: default confirm-to-post (`proposed` until user confirms)
- FX: purchase-time default + user micro-adjustments
- Posting signs: + = debit, − = credit
