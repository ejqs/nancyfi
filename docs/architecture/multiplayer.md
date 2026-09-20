# Multiplayer & sharing

## Goal

Budgets are collaborative. Each user can have **many budgets**. Users can **invite** others into a budget and edit together, including while offline, with CRDT merge on sync.

## Concepts

| Concept | Meaning |
| --- | --- |
| User | Authenticated person using Nancyfi |
| Budget | Collaboration unit; primary Automerge document boundary |
| Membership | Link between a user and a budget; roles: **owner** \| **contributor** (control plane) |
| Invite | Email-link mechanism to add another person to a budget as **contributor** |

## Requirements

1. A user can create multiple budgets.
2. A user can open any budget they own or have been invited to.
3. An authorized member can invite another person to a specific budget.
4. Concurrent edits by multiple members merge via CRDT rules (see [offline-first & CRDTs](./offline-first-and-crdt.md)).
5. Revoking access / leaving a budget is defined (see [Invites](#invites-shipped)).

## Boundaries

- **CRDT document** — budget content (accounts, balanced entries, plans, rule applications/runs). See [data model](./data-model.md).
- **Control plane** — identity, membership (`owner` / `contributor`), invites. Not pure CRDT; authority must not live only inside the Automerge doc.
- **Crypto ACL (future)** — Automerge Keyhive / ARK may encrypt docs and grant `relay` / `read` / `edit` / `admin` at the CRDT layer. Product roles stay on the control plane; Keyhive grants should be derived from invites/membership, not replace them. See [offline-first — Keyhive](./offline-first-and-crdt.md#future--keyhive--ark) and [NAN-38](https://linear.app/nancyfi/issue/NAN-38/eventually-automerge-keyhive-ark-e2e-crypto-acl-when-stable).
- **Lenses & DisplayProfiles** — household **default Lenses** (soft shared starting point) plus **personal** Lenses/DisplayProfiles that override per member. See [Lenses and personalization](./lenses-and-personalization.md).

Shared **Plans** and applied **Rules** affect money or proposals for everyone on the budget. Lenses never do. Paying debt from any Lens still writes shared Entries.

### Public / guest share links (eventually)

Separate from membership: tokenized **ShareLinks** for outsiders to **view a Lens-scoped slice** or take **allowlisted actions** (e.g. mark a dinner share paid → flexible **for review** workflow). Guests do not get full CRDT write or `contributor` role. See [Public / guest share links](./public-share-links.md).

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

### Invites (shipped)

| Concern | Decision |
| --- | --- |
| Path | **Email link** — owner invites by email; accept at `/invites/[token]` |
| Table | `budget_invite` (token, email, status, expiresAt) |
| Default role | Always `contributor` (not client-supplied) |
| Who can invite | **Owners only** (v1) |
| Accept | Online + signed-in session; invitee email must match invite email |
| Offline accept | Not supported |
| Email delivery | Best-effort via Resend; owner can still copy the accept URL if send fails |
| Expiry | 7 days; pending invites marked expired on read |
| Re-invite | Cancels prior pending invite for the same email on that budget |

**Revoke / leave**

| Action | Who | Behavior |
| --- | --- | --- |
| Cancel pending invite | Owner | Sets invite `status = cancelled` |
| Revoke member | Owner | Deletes contributor membership only (cannot revoke owners) |
| Leave budget | Any member | Deletes own membership; **last owner cannot leave** — archive instead |
| **Reset account to 0** ([NAN-35](https://linear.app/nancyfi/issue/NAN-35/reset-user-account-back-to-empty-0-budgets)) | Signed-in user | **Hard-deletes** budgets the user solely owns (memberships + invites cascade), leaves all other memberships, cancels remaining pending invites for that user, clears local Automerge storage; login kept. Dashboard **Reset account to 0**. |
| CRDT | — | Revoke/leave do not delete Automerge content. Account reset deletes control-plane budget rows; remote Automerge blobs may remain until sync GC. |

UI: `MembersPanel` on the budget workspace. Accept UI: `/invites/[token]`. Account reset: dashboard `AccountResetPanel`.

## Open decisions

- Whether contributors can invite others (owners only for now).
- Ownership transfer between members.
- Who may edit household default Lenses (`owner` only vs any `contributor`) — see [Lenses](./lenses-and-personalization.md).
- Public ShareLinks (view / limited act) — design in [public share links](./public-share-links.md); ship after membership invites.
