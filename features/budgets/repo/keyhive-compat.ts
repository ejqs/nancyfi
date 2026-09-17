/**
 * Compatibility shims / constants for a future Automerge Keyhive (ARK) adoption.
 *
 * Do NOT depend on `@automerge/automerge-repo-keyhive` until it is stable
 * ([NAN-38](https://linear.app/nancyfi/issue/NAN-38/eventually-automerge-keyhive-ark-e2e-crypto-acl-when-stable)).
 *
 * Guide (alpha, will change): https://automerge.org/docs/keyhive/ark-api-guide/
 *
 * Keep these constraints true in current code:
 * - Sync JWT `peerId` is an opaque string (ARK will use verifying-key peer ids)
 * - Document IndexedDB (`nancyfi-automerge`) must stay separable from keyhive storage
 * - Sync server remains a byte relay (no plaintext budget logic)
 * - Control-plane membership stays product authority; Keyhive is crypto ACL only
 */

/**
 * Root field ARK writes when rotating keys after adding a member.
 * Skip when iterating budget document keys for product UI / exports.
 * @see https://automerge.org/docs/keyhive/ark-api-guide/
 */
export const KEYHIVE_NUDGE_FIELD =
  "__automerge-repo-keyhive__last-added-member-ts" as const

/** True for reserved Keyhive root fields that are not budget domain data. */
export function isKeyhiveReservedRootField(key: string): boolean {
  return (
    key === KEYHIVE_NUDGE_FIELD || key.startsWith("__automerge-repo-keyhive__")
  )
}

/**
 * Storage name reserved for a future Keyhive state adapter.
 * Must not collide with {@link INDEXED_DB_NAME} (`nancyfi-automerge`).
 */
export const KEYHIVE_STORAGE_NAME_RESERVED = "nancyfi-keyhive"
