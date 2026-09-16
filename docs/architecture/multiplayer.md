# Multiplayer & sharing

## Goal

Budgets are collaborative. Each user can have **many budgets**. Users can **invite** others into a budget and edit together, including while offline, with CRDT merge on sync.

## Concepts

| Concept | Meaning |
| --- | --- |
| User | Authenticated person using Nancyfi |
| Budget | Collaboration unit; primary Automerge document boundary |
| Membership | Link between a user and a budget; roles: **owner** \| **contributor** (control plane) |
| Invite | Mechanism to add another person to a budget |

## Requirements

1. A user can create multiple budgets.
2. A user can open any budget they own or have been invited to.
3. An authorized member can invite another person to a specific budget.
4. Concurrent edits by multiple members merge via CRDT rules (see [offline-first & CRDTs](./offline-first-and-crdt.md)).
5. Revoking access / leaving a budget must be defined before production invites ship (open decision).

## Boundaries

- **CRDT document** — budget content (accounts, balanced entries, plans, rule applications/runs). See [data model](./data-model.md).
- **Control plane** — identity, membership (`owner` / `contributor`), invites. Not pure CRDT; authority must not live only inside the Automerge doc.

Invites and membership are system concerns documented here; budget-domain rules live under `features/budgets/docs/`.

### Membership (shipped)

| Concern | Where |
| --- | --- |
| Tables | `budget`, `budget_membership` (Postgres / Drizzle) |
| Roles | `owner` \| `contributor` — assigned only by control-plane APIs |
| Create | Creator is always inserted as `owner` (role is not client-supplied) |
| List | Derived from `budget_membership` for the signed-in user |
| CRDT | Must not authorize role elevation; ignore any role-like fields in the doc |

Server entry points: `features/budgets/actions.ts` (`createBudgetAction`, `listBudgetsAction`, …).
## Open decisions

- Invite UX: email link, in-app username, share code.
- Default invite role: `contributor` (no separate viewer role yet).
- Whether contributors can invite others.
- Offline invite acceptance behavior.
- Revoking access / leaving a budget (required before production invites).
