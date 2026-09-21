# Scenario: payday, subscriptions, and debt reimbursement

This scenario is based on the budgeting spreadsheet that motivated Nancyfi. It is a design target for the data model, Rules, and derived views. Exact personal amounts are intentionally omitted.

## Context

The budget owner:

- receives salary twice monthly;
- allocates income across fixed costs, percentage categories, spending, debt repayment, and savings;
- pays some costs through their mother and later reimburses her;
- has monthly, annual, and installment purchases;
- tracks PHP and foreign-currency prices.

## Payday calendar

Paydays are:

1. The 15th of the month.
2. The final calendar day of the month.

If either date falls on a **weekend or a Philippine holiday**, payday moves to the nearest earlier weekday that is neither. **Current engine** (`features/budgets/schedule.ts`) adjusts weekends only; holiday calendars are a follow-on (see [NAN-19](https://linear.app/nancyfi/issue/NAN-19/decide-open-money-schedule-fx-policies); optional later: pluggable calendars / rules marketplace).

At payday, the owner wants Nancyfi to:

- recognize or match the salary deposit;
- calculate the period's fixed and percentage allocations;
- propose payments due on that payday;
- show what remains available after those commitments.

The same payday occurrence must not run twice when multiple offline devices reconnect.

### Variable actual salary (resolved)

Actual pay often differs from the Plan’s typical amount (absence, overtime, bonuses).

**Do not edit the salary Plan for a one-off variance.** That Plan is the expectation for future paydays.

Instead:

1. The payday occurrence fires and a **RuleRun** is recorded (idempotent `occurrenceKey`).
2. Automation creates a **proposed** salary **Entry** seeded from the Plan amount (or matches an imported deposit).
3. The owner **edits the proposed Entry** to the actual amount before posting.
4. Percentage **allocation** proposals recalculate from that **actual** proposed/posted salary, not from the Plan’s typical figure.
5. Confirming posts the Entries. The RuleRun still proves the occurrence ran; the Entry holds what actually landed.

Matching a real deposit (`onEntryMatched` / MCP) can satisfy the same occurrence with the bank amount — still one RuleRun, one logical result. Optional later: retain a seed/expected amount on the Entry to show “expected vs actual” without another table.

## Monthly allocation

Income is allocated to broad groups such as Needs, Wants, and Savings, then to more specific purposes such as:

- statutory contributions;
- church and missions;
- food and gas;
- subscriptions;
- generosity and debt repayment;
- fiat, investment, or other savings.

An allocation may be:

- a percentage of actual salary;
- a fixed monthly amount;
- split across both paydays;
- bounded by a hard limit or end date.

Changing a percentage or salary amount must update the plan without rewriting already-posted history.

## Subscriptions

The subscription view includes online and offline services with different terms:

- monthly services paid half on the 15th and half at month-end;
- annual services whose cost is spread across 12 monthly reimbursements (**settlement cadence is customizable** per Plan; this scenario’s default: **split 1/12 across both paydays**);
- purchases paid over a fixed installment term, such as 24 months;
- services priced in another currency but settled in PHP;
- services paid directly and services initially paid by the owner's mother.

Service cadence and settlement cadence are separate. An annual service can renew once a year while its purchase debt is repaid monthly.

## Debt reimbursement

When another person pays an annual or installment purchase upfront:

1. The purchase creates or increases an obligation to that person.
2. A repayment plan defines the amount, cadence, and optional number/end date of payments.
3. Each actual repayment reduces the outstanding obligation.
4. Remaining debt and projected completion are derived from posted financial entries.

The original principal, repayments, adjustments, and outstanding amount must remain distinguishable. Remaining debt must not be maintained as a second manually edited balance.

## Cancellation midway

When a subscription is cancelled:

1. Mark the service plan cancelled from an effective date.
2. Stop future service occurrences.
3. Preserve charges and payments that already happened.
4. Preserve any outstanding debt and its repayment plan.
5. Reflect the change in derived views automatically.

The cancelled item disappears from the active subscription view but remains in the debt view until its obligation is settled. No record is copied or manually moved between lists.

## Required derived views

The same underlying facts and plans must support:

- monthly budget percentages and amounts;
- per-payday amounts and payment checklist;
- current monthly subscription burn;
- active subscriptions and installment end dates;
- debt principal, repayments, outstanding balance, and projected completion.

These are projections, not independent sources of truth.

## Current primitive mapping

This mapping is informative; the scenario remains valid if implementation details change.

| Scenario concept | Current primitive |
| --- | --- |
| Budget and calendar | Budget |
| One-off buy you chip away at (Headphones-this-buy) | **Purchase Entry** + nested repayment Entries (`parentId`). Remaining derived. Not an Account. |
| Bank, cash, income, expense folders, and money owed to another person | Account (`parentId` = folders only) |
| Salary deposit, charge, allocation, or repayment that happened/is proposed | Entry with balanced Postings |
| Subscription, salary expectation, allocation policy, installment purchase, or debt repayment | Plan (`subscription` / `income` / `allocation` / `repayment`; user **templates** for installment vs owe-Mom labels) |
| Payday reaction, matching, percentage allocation, or unusual automation | Rule |
| Exact currency value | Money |
| Payday checklist, burn, subscriptions, debt board, custom rollups | Lens (household default and/or personal) |
| How an Entry row/card looks for one member | DisplayProfile |

See [system data model](../architecture/data-model.md), [budget data model](../../features/budgets/docs/data-model.md), and [Lenses and personalization](../architecture/lenses-and-personalization.md).

## Task command invariants

The default UI does not expose primitive construction. A user chooses a task;
Nancyfi creates or validates the complete primitive set in one Automerge
change:

1. **Expense** — payment asset, expense category, and balanced posted Entry.
2. **Income** — income source, deposit asset, and balanced posted Entry.
3. **Salary** — income source, deposit asset, income Plan, and payday schedule.
4. **Subscription** — expense category, payment asset, subscription Plan, and
   schedule.
5. **Debt repayment** — liability Account, payment asset, repayment Plan, and
   optional opening-obligation Entry.

A repayment Plan without a linked liability is incomplete and must not appear
as valid debt. Existing incomplete records get a **Finish setup** path; they are
not silently migrated because Nancyfi cannot infer who is owed or the original
principal safely.

Default product language is transaction / recurring item / needs review /
prepare / confirm. Entry / Plan / proposed / post / void, Account kinds,
posting direction, and occurrence count are reserved for advanced data views.

Work:
[NAN-31](https://linear.app/nancyfi/issue/NAN-31/simplify-core-money-flow-with-scenario-safe-tasks).

## Acceptance invariants

1. **Exact money:** values use integer minor units; conversions retain currencies and an explicit exchange rate.
2. **Idempotent automation:** one scheduled occurrence produces at most one logical result, including after offline merges.
3. **Auditable history:** cancellation and plan edits never erase posted Entries.
4. **Derived debt:** remaining on a purchase **Entry** equals debit minus nested posted repayment Entries. Settlement nouns (Mom, Checking) stay Accounts.
5. **Explainability:** every proposed/generated Entry links to the Plan occurrence and Rule version that produced it.
6. **Variable actual vs Plan:** editing a proposed salary Entry (or matching a deposit) does not delete the RuleRun; percentage allocations use actual salary; the Plan’s typical amount is unchanged by one-off variance.
7. **Scenario-safe commands:** task creation cannot complete with missing or
   incompatible Accounts (for example, a repayment Plan without a liability).

## Policy decisions ([NAN-19](https://linear.app/nancyfi/issue/NAN-19/decide-open-money-schedule-fx-policies))

All resolved:

1. **Annual 1/12 reimbursement cadence** — Customizable per Plan. Scenario default: **split across both paydays** (each payday gets half of the monthly 1/12). Alternative: once monthly.
2. **Weekday / holiday adjustment** — Adjust for **weekends and Philippine holidays** (previous open weekday). Engine today: weekends only; holiday calendars + optional pluggable calendars / rules marketplace are later work.
3. **Auto-post vs confirmation** — Generated Entries stay **`proposed` until the user confirms**. Opt-in auto-post per Plan/Rule may come later.
4. **FX rate** — Default to **purchase-time** rate; allow **small user adjustments** over time to correct error.
5. **Posting sign convention** — **Positive `amountMinor` = debit; negative = credit.** Assets/expenses increase with debits; liabilities/income increase with credits. UI hides this via from→to balancing helpers.
