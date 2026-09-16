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
  rulesAppliedById
  ruleRunsById

Account
  id, name, kind, parentId?

Entry
  id, description, effectiveAt, status
  postings[] { accountId, money, role? }
  sourcePlanOccurrenceId?

Plan
  id, name, kind, status
  amountOrFormula, schedule
  linkedAccountIds, occurrenceIds

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
| `money` | Money | Signed value |
| `role` | string? | e.g. `principal`, `payment`, `expense`, `allocation`, `adjustment` |

Posted Entries balance per currency. The UI can present a simple amount/account form and generate the balancing posting internally.

This replaces positional `amounts[]`: ordering is unsafe under concurrent insertion, and a raw amount does not explain whether it is a charge, payment, allocation, or adjustment.

## Plan

A Plan is stored future intent: salary, allocation, subscription, installment, debt repayment, or another commitment.

| Field | Type | Notes |
| --- | --- | --- |
| `id` | string | Stable ID |
| `name` | string | Human label |
| `kind` | `income` \| `allocation` \| `subscription` \| `installment` \| `obligation` \| `other` | UI/default behavior |
| `status` | `active` \| `paused` \| `cancelled` \| `completed` | Lifecycle |
| `amountOrFormula` | object | Fixed money, percentage, remaining balance, or extension |
| `schedule` | Schedule? | Recurrence and business-day adjustment |
| `linkedAccountIds` | string[] | Income, expense, liability, and settlement accounts |
| `occurrenceIds` | string[] | Generated proposal/run references |

Plans generate proposed Entries. A user or explicit auto-post policy turns proposals into posted facts. Cancelling a Plan stops future occurrences but never deletes posted history or an outstanding liability.

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

Holiday-calendar behavior remains an open decision.

## Money and foreign exchange

```text
Money {
  amountMinor: integer
  currency: ISO-4217 string
}
```

Never use floating-point money. Represent exchange rates as decimal strings or rational values. A multi-currency Entry records explicit conversion metadata and balancing postings.

## Spreadsheet scenarios

The full design goal and acceptance invariants live in [Scenario: payday, subscriptions, and debt reimbursement](../../../docs/scenarios/payday-subscriptions-and-debt.md).

### Payday and allocations

A salary Plan uses semi-monthly anchors (`15`, `endOfMonth`) adjusted to the previous weekday. Allocation Plans use fixed or percentage formulas targeting income/expense/savings Accounts.

### Subscriptions and installments

A subscription Plan records the service cadence and price. Settlement may follow another schedule: half per payday, 1/12 of an annual purchase, or one of 24 installments.

### Debt and cancellation

An annual purchase can increase a liability Account and create a repayment Plan. Each posted payment reduces that liability. Cancelling the service Plan stops future service occurrences; the liability and repayment Plan remain until settled.

Subscription and debt screens are derived views. An item can disappear from subscriptions while remaining in debt without moving or duplicating records.

## Automerge notes

- Store entities in maps keyed by stable IDs.
- Lists contain IDs only where user-defined order matters.
- Rule/Plan occurrences use deterministic IDs to prevent duplicate execution across offline devices.
- Initialize schema once and share ancestry; see [Modeling Data](https://automerge.org/docs/cookbook/modeling-data/).

## Open decisions

- Sign convention for postings
- Holiday calendar behavior
- Auto-post policy vs required confirmation
- Archive/delete behavior under CRDT tombstones
