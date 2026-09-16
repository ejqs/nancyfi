# Public and guest share links

Tokenized links so people **outside** a budget membership can **view a scoped slice** or take **narrow actions** (e.g. “mark my dinner share paid → for review”), without becoming `owner` / `contributor` or writing the full Automerge doc.

Membership invites remain the path for full collaborators — see [multiplayer](./multiplayer.md).  
Scoped boards use [Lenses](./lenses-and-personalization.md).  
Money truth stays [Accounts / Entries / Plans](./data-model.md).

**Horizon:** eventually / after core membership invites and Lenses. Not a day-one Foundation blocker.

## Problem

Examples:

1. **View** — Share a link that shows debt status for Entries with certain tags (or a debt Lens), so a creditor or family member can track progress without a Nancyfi account.
2. **Limited edit** — Split a dinner; send each person a link. They mark their end paid; on the owner’s side that shows as **for review** (or another status) until a member confirms and money is posted.

Statuses must stay **flexible** — not a fixed product enum of only `paid` / `for_review`.

## Not membership

| Path | Who | Access |
| --- | --- | --- |
| **Membership + invite** | Signed-in user | Full (or role-limited) budget CRDT; offline multiplayer |
| **Share link** | Anyone with the token (guest; account optional later) | Only what the link allows: a Lens projection and/or allowlisted actions |

Share links **must not**:

- Grant Automerge write of the whole BudgetDoc.
- Elevate to `owner` / `contributor`.
- Auto-post money without a member confirmation path (default for guest “I paid” claims).

## Primitives

### ShareLink (control plane)

Authoritative record (Postgres / similar), never only inside the CRDT:

| Field (informative) | Notes |
| --- | --- |
| `id` / secret token | Unguessable URL token; rotatable / revocable |
| `budgetId` | Target budget |
| `mode` | `view` \| `act` (act implies view of the same scope) |
| `lensId` or embedded Lens | What outsiders see (e.g. filter `labels` / tags) |
| `capabilities` | Allowlisted actions (see below) |
| `statusSchemeId` | Which flexible workflow applies to claims on this link |
| `expiresAt` / `revokedAt` | Lifecycle |
| `createdByUserId` | Member who minted the link |

Optional: **per-guest claim tokens** (same ShareLink parent, different `subjectEntryId` / participant) so one dinner guest cannot mark another’s share.

### Capability

Narrow verbs, not “edit budget”:

| Example capability | Effect |
| --- | --- |
| `viewLens` | Read projection only |
| `transitionStatus` | Move a visible item along an allowlisted edge in the StatusScheme |
| `submitPaymentClaim` | Create a **Claim** / proposed Entry marked for member review |

Capabilities are declared on the ShareLink. Guests cannot invent new verbs.

### StatusScheme (flexible statuses)

A small, budget-owned (or template) workflow definition — **not** hard-coded product statuses.

```text
StatusScheme "Dinner settle"
  statuses: [
    { id: owed, label: "Owes" },
    { id: claimed_paid, label: "Marked paid (guest)" },
    { id: for_review, label: "For review" },
    { id: settled, label: "Settled" },
    { id: disputed, label: "Disputed" }
  ]
  transitions: [
    { from: owed, to: claimed_paid, by: guest },
    { from: claimed_paid, to: for_review, by: system },  // or guest lands directly on for_review
    { from: for_review, to: settled, by: member },
    { from: for_review, to: disputed, by: member },
    { from: disputed, to: owed, by: member }
  ]
```

Members configure labels and edges. Built-in templates (“simple debt tracker”, “split bill”) seed common schemes; budgets can fork them.

**Ledger rule:** reaching a status like `settled` **may** auto-suggest or require posting a real **Entry**. Status alone is not a second balance. Outstanding money stays derived from posted postings.

### Claim (guest-originated intent)

When a guest acts (e.g. “I’ve paid”):

1. Control plane records a **Claim** (who/token, target Entry or split line, requested transition, timestamp).
2. Target item moves to a review status per StatusScheme (e.g. `for_review`).
3. A member accepts → optional proposed/posted **Entry** + status `settled`; or rejects → `disputed` / back to `owed`.

Claims are auditable. Idempotent per (token, target, transition) so refresh/double-tap does not duplicate.

## How it maps to Lenses

| Need | Mechanism |
| --- | --- |
| “All entries with certain tags” | ShareLink pins a **Lens** (`filter: labels includes …`) |
| Debt status board for outsiders | View-only ShareLink + debt Lens |
| Dinner split per person | Act ShareLink + Lens of that event’s lines + optional per-guest subject |

Household/personal Lenses stay for members. ShareLinks pin a Lens **for the token**; guests do not get arbitrary Lens editing.

## Security bar (design)

1. Unpredictable tokens; HTTPS-only links.
2. Revoke and expire; rotate without changing budget id.
3. Scope: Lens filter + capability allowlist + optional subject id.
4. Rate-limit guest actions; no bulk export of the full budget.
5. Never expose unrelated Accounts/Entries outside the Lens.
6. Default: guest cannot `posted`-status money; member confirms.
7. Audit log: Claim + ShareLink id + outcome.

Open product choices: require email OTP for `act` links; watermark “shared view”; password on link.

## Relation to Entry.status

Existing Entry lifecycle (`proposed` \| `posted` \| `void`) remains the **accounting** lifecycle.

**StatusScheme** is a separate, flexible **workflow** layer for collaboration / guest claims (and optionally member review queues). Do not overload `proposed` to mean “guest said they paid” — that confuses money posting with social acknowledgment.

Optional link: `workflowStatusId` on an Entry (or on a split line value object) while `Entry.status` stays accounting-only.

## Scenarios (acceptance sketches)

### View debt by tags

1. Member tags obligation Entries `mom-reimburse`.
2. Creates view ShareLink with Lens filter on that tag.
3. Outsider opens link → sees derived outstanding / progress only for those Entries.
4. Revoking the link stops access; history of Claims (if any) remains for members.

### Dinner split → guest marks paid → for review

1. Member creates split lines (Entries or line items) with StatusScheme starting at `owed`.
2. Sends act links (or one link + identity step) to guests.
3. Guest transitions to `claimed_paid` / lands on `for_review`.
4. Member review queue shows those items; accept posts payment Entry and sets `settled`.
5. Guest cannot alter others’ lines or see unrelated budget data.

## Open decisions

1. Guest identity: anonymous token only vs email/OTP vs optional Nancyfi account.
2. Where StatusScheme and Claim live: control plane only vs mirrored summary in CRDT for offline members.
3. Split-bill line: first-class entity vs Entry-per-person vs Plan occurrence.
4. Whether `act` links may ever auto-post Entries (policy; default no).
5. Who may mint ShareLinks (`owner` only vs `contributor`).

Work: [NAN-21](https://linear.app/nancyfi/issue/NAN-21/public-guest-share-links-view-limited-act) (Foundation; Could / later).

## Related

- [Multiplayer](./multiplayer.md) — membership vs this path
- [Lenses and personalization](./lenses-and-personalization.md)
- [Data model](./data-model.md)
- [Requirements](../requirements.md) (Could)
