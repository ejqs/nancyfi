# Requirements

System-level requirements for Nancyfi. Feature-specific requirements live under `features/<feature>/docs/`.

## Must

1. **Budgeting core** — users can create and manage budgets in a simple, flexible model.
2. **Responsive web** — layouts and interactions work on desktop, tablet, and mobile.
3. **Offline-first** — core budget data is usable without a continuous network connection.
4. **CRDT sync** — concurrent changes from multiple devices/users merge without manual conflict resolution for supported data types ([Automerge](https://automerge.org/docs/hello/)).
5. **Many budgets per user** — a user can own or belong to as many budgets as they need.
6. **Invites** — a budget owner (or permitted role) can invite other people to that budget.

## Should

1. Local persistence so a refresh or short offline period does not lose work.
2. Clear sync status when online/offline or catching up.
3. Document modeling that favors collaboration units (a budget as a sync boundary) — see [Automerge modeling guidance](https://automerge.org/docs/cookbook/modeling-data/).

## Could (later)

1. Rich-text notes on budgets or line items via ProseMirror + Automerge ([cookbook](https://automerge.org/docs/cookbook/rich-text-prosemirror-react/)).
2. Deeper history / version browsing of budget documents.
3. Roles beyond basic invitee access (viewer, editor, admin).
4. **MCP** so the user’s own AI can update accounts/transactions (e.g. from email) — preferred over bank aggregation; see [features/mcp/docs](../features/mcp/docs/README.md) ([brief root note](./architecture/mcp-and-email-updates.md)).

## Won’t (near term)

1. Native iOS/Android apps as the primary client.
2. Requiring always-online server authority for every edit.
3. Day-one dependence on traditional bank sync / aggregation APIs (unavailable in most countries).
