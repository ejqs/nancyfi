# Rules (feature)

Event-driven automation so flexibility can reign: behavior when a date hits, when an Entry appears, and other triggers later—without baking one budgeting methodology into the core model.

System index: [docs/architecture/data-model.md](../../../docs/architecture/data-model.md).  
Budget apply-list: [budgets data model](../../budgets/docs/data-model.md) (`rulesApplied`).

## Intent

Rules are first-class automation. Examples:

- Recurring subscription on a schedule
- When salary (or any matching entry) comes in → allocate / create follow-up entries
- Disable a rule with an optional end time

Rules have two layers:

1. **Declarative built-ins** for schedules, matching, percentages, installments, and business-day adjustment.
2. **Sandboxed custom logic** for niche cases that built-ins cannot express.

Custom logic is an escape hatch, not the storage location for financial intent.

## Plans are data; Rules are behavior

- **Plan:** what should happen
- **Rule:** when and how to react
- **Entry:** what concretely happened or is proposed
- **Account:** where the financial effect lands

Example: a Plan records “pay Mom a fixed amount twice monthly until August 2028.” A Rule reacts on each payday and generates the next proposed Entry. Posted Entries reduce the liability, so remaining debt is derived.

Without Plan, amount, recipient, cadence, end date, and remaining occurrences live only inside JavaScript. Nancyfi would need to execute arbitrary code to show upcoming payments, explain generated Entries, calculate remaining debt, or cancel safely. Rules would become an **uninspectable second database**.

Rules may read Plans and events, generate proposed Entries, reconcile imported Entries, or update Plan lifecycle. They do not silently rewrite posted history.

## Rule definition

| Field | Type | Notes |
| --- | --- | --- |
| `id` | string | Stable id |
| `source` | string | Custom logic body (JS or equivalent) |
| `triggers` | Trigger[] | When this rule may run |
| `visibility` | Visibility | Sharing scope |
| `moderationStatus` | `active` \| `revoked` | Safety lifecycle |
| `versionHash` | string | Pins executed source |

### Visibility

| Value | Meaning |
| --- | --- |
| `public` | Discoverable / shareable |
| `private` | Owner (or budget) only |
| `unlisted` | Not listed; usable if you have the id |

Revocation is separate from visibility. A revoked shared Rule cannot execute again, but its historical outputs remain auditable.

### Triggers (v1 starting set)

Extensible list — add triggers without changing Budget / Entry shapes.

| Trigger | Fires when |
| --- | --- |
| `onDate` | A schedule / calendar condition is met |
| `onEntryCreated` | A new entry is created on the budget |
| `onEntryMatched` | An entry matches rule-defined criteria (payee/name/amount/…) |
| `onPlanOccurrence` | A Plan occurrence becomes due |

Later candidates: MCP write, balance threshold, rule chaining — only as needed.

## Application on a budget

Stored on the budget document as `rulesApplied[]`:

| Field | Type | Notes |
| --- | --- | --- |
| `ruleId` | string | Rule definition id |
| `status` | `enabled` \| `disabled` | |
| `pausedUntil` | timestamp? | Optional temporary pause |
| `endsAt` | timestamp? | Optional permanent scheduling boundary |

See [budgets data model](../../budgets/docs/data-model.md).

## Runtime & safety

1. **Sandbox** — custom logic gets only allowlisted APIs; no arbitrary network, DOM, or filesystem access.
2. **Idempotency** — each occurrence has a stable key such as `ruleId + versionHash + scheduledDate`, preventing duplicate output across offline devices.
3. **Revocation** — clients refuse future execution of revoked sources; historical runs and Entries remain.
4. **Auditability** — every run records Rule version, trigger/event ID, status, and generated Entry IDs.
5. **Authorization** — control-plane roles determine who may attach, enable, or edit a Rule.

## Storage split

| Piece | Where |
| --- | --- |
| Private rule `source` used only by one budget | May live in or beside that budget doc |
| Shared / public / unlisted catalog + revocation | Control plane / catalog service |
| `rulesApplied` | Budget Automerge doc |
| Rule runs and generated occurrence IDs | Budget Automerge doc |

## Requirements (feature)

### Could (when prioritized)

1. Attach a built-in or custom Rule with at least one date/Plan trigger and one Entry trigger.
2. Enable / disable / set `endsAt` on `rulesApplied`.
3. Sandbox blocks network and arbitrary DOM/filesystem access.
4. Revoked rules do not execute.
5. Re-running the same occurrence cannot generate a duplicate Entry.

### Won’t

1. Running unsandboxed user JS in the main app origin.
2. Treating rules as a replacement for membership/authz.

## Open decisions

- Exact language/runtime (QuickJS, isolated worker, DSL compile-to-sandbox, …)
- Allowed API surface inside the sandbox
- Whether public rules need signing / hash pinning before apply
- Conflict policy if two rules mutate the same entry concurrently
- Which actions require user confirmation instead of auto-posting

## Related docs to add later

- `triggers.md` — full trigger catalog
- `sandbox.md` — runtime and allowlisted APIs
- `catalog.md` — public/hidden/revoked distribution
