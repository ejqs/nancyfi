# Scenarios

Scenarios are executable design goals for Nancyfi's primitives, data model, rules, and UI.

**Work to implement scenarios is tracked in Linear** ([Nancyfi Foundation](https://linear.app/nancyfi/project/foundation-cb065a209b99)), not in markdown task lists.

## Purpose

A scenario describes what a person needs to accomplish and which invariants must hold. It should not prescribe database fields or UI components.

Before adding or changing a primitive, prove that the proposed model:

1. Represents the scenario without duplicating financial truth.
2. Keeps facts, plans, and derived views distinct.
3. Explains generated changes without executing arbitrary custom code.
4. Produces deterministic, idempotent results across offline devices.
5. Preserves history when plans change or are cancelled.

Common behavior should be represented as inspectable data. Sandboxed custom Rules remain the escape hatch for genuinely unusual logic.

## Scenario catalog

- [Payday, subscriptions, and debt reimbursement](./payday-subscriptions-and-debt.md) — semi-monthly salary, percentage allocation, subscription cadences, installments, cancellation, and debt

## Using scenarios during design

For every data-model proposal:

- Map each scenario concept to a primitive.
- Identify stored facts, stored plans, and derived views.
- List which behavior is declarative and which requires custom logic.
- Add acceptance examples for cancellation, concurrency, and retries.
- Record unresolved policy choices instead of hiding them in implementation.

Feature-specific scenarios may live in `features/<feature>/docs/scenarios/`; cross-feature scenarios belong here.
