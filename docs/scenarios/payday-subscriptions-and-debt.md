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

If either date falls on a weekend, payday moves to the nearest earlier weekday.

At payday, the owner wants Nancyfi to:

- recognize or match the salary deposit;
- calculate the period's fixed and percentage allocations;
- propose payments due on that payday;
- show what remains available after those commitments.

The same payday occurrence must not run twice when multiple offline devices reconnect.

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
- annual services whose cost is spread across 12 monthly reimbursements;
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
| Bank, cash, income, expense, and money owed to another person | Account |
| Salary deposit, charge, allocation, or repayment that happened/is proposed | Entry with balanced Postings |
| Subscription, salary expectation, allocation policy, installment, or obligation | Plan |
| Payday reaction, matching, percentage allocation, or unusual automation | Rule |
| Exact currency value | Money |

See [system data model](../architecture/data-model.md) and [budget data model](../../features/budgets/docs/data-model.md).

## Acceptance invariants

1. **Exact money:** values use integer minor units; conversions retain currencies and an explicit exchange rate.
2. **Idempotent automation:** one scheduled occurrence produces at most one logical result, including after offline merges.
3. **Auditable history:** cancellation and plan edits never erase posted Entries.
4. **Derived debt:** outstanding debt equals posted obligation changes and repayments.
5. **Explainability:** every proposed/generated Entry links to the Plan occurrence and Rule version that produced it.

## Open policy questions

- Is an annual service's 1/12 monthly reimbursement paid once monthly or split across both paydays?
- Should “weekday” adjustment consider only weekends or also Philippine holidays?
- Which Entries may auto-post, and which require confirmation?
- Which exchange rate applies: purchase-time, payment-time, or a manually agreed rate?
