# Data model (system)

Nancyfi uses a small accounting kernel while keeping accounting terminology out of the default UI.

Feature detail:

- [Budgets data model](../../features/budgets/docs/data-model.md) — Budget, Account, Entry, Plan, and nested values
- [Rules](../../features/rules/docs/README.md) — declarative automation plus sandboxed custom logic

Design test: [payday, subscriptions, and debt reimbursement](../scenarios/payday-subscriptions-and-debt.md).

## Three kinds of truth

1. **Facts** — salary arrived, a subscription was charged, a debt payment was made.
2. **Plans and commitments** — reserve a percentage, pay twice monthly, repay a purchase over 12 months.
3. **Derived views** — monthly burn, subscriptions, percentage used, and remaining debt.

Persist facts and plans. Derive views instead of maintaining several mutable lists that can drift apart.

## Primitives

| Primitive | Role |
| --- | --- |
| **Budget** | Collaboration boundary plus calendar and currency settings |
| **Account** | Typed financial container: asset, liability, income, or expense |
| **Entry** | Proposed or posted financial event with balanced postings |
| **Plan** | Stored future intent: income, allocation, subscription, installment, or obligation |
| **Rule** | Trigger → condition → action behavior applied to plans and events |

**Money**, **Posting**, **Schedule**, **Trigger**, and **Action** are nested value objects, not top-level entities.

## Plan, Rule, and Entry

- **Plan:** what should happen
- **Rule:** when and how to react
- **Entry:** what concretely happened or is proposed
- **Account:** where the financial effect lands

For example, a Plan records “pay Mom a fixed amount twice monthly until August 2028.” A Rule reacts on each payday and generates the next proposed Entry. Posted Entries reduce the liability, so remaining debt is derived rather than manually stored.

Without Plan, the amount, recipient, cadence, end date, and remaining occurrences live only inside custom code. Nancyfi would have to execute arbitrary code to show upcoming payments, explain an Entry, calculate remaining debt, or cancel safely. Rules would become an **uninspectable second database**.

## CRDT vs control plane

| In budget Automerge doc | Control plane / catalog |
| --- | --- |
| Accounts, Entries, Plans, rule applications and runs | User identity |
| Optional private rule source | Membership (`owner` \| `contributor`) and invites |
| Generated occurrence IDs | Shared rules, moderation/revocation, sandbox policy |

Membership authority is never only inside the CRDT doc; a contributor must not be able to merge themselves into `owner`.

Store entities in maps keyed by stable IDs. Lists contain IDs only when user-defined order matters.

## Money and currencies

Use integer minor units plus an ISO currency code. Never use floating-point values for money. Represent foreign-exchange rates as decimal strings or rational values, not floats.

## Related

- [Offline-first & CRDTs](./offline-first-and-crdt.md)
- [Multiplayer](./multiplayer.md)
- [MCP (brief)](./mcp-and-email-updates.md) → [features/mcp](../../features/mcp/docs/README.md)
- [Automerge modeling](https://automerge.org/docs/cookbook/modeling-data/)
