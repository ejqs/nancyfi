import { describe, expect, test } from "bun:test"

import {
  isKeyhiveReservedRootField,
  KEYHIVE_NUDGE_FIELD,
  KEYHIVE_STORAGE_NAME_RESERVED,
} from "./keyhive-compat"
import { INDEXED_DB_NAME } from "./create-browser-repo"

describe("keyhive-compat", () => {
  test("recognizes the ARK nudge field and reserved prefix", () => {
    expect(isKeyhiveReservedRootField(KEYHIVE_NUDGE_FIELD)).toBe(true)
    expect(
      isKeyhiveReservedRootField("__automerge-repo-keyhive__something-else"),
    ).toBe(true)
    expect(isKeyhiveReservedRootField("accountsById")).toBe(false)
  })

  test("keeps document and keyhive storage names distinct", () => {
    expect(KEYHIVE_STORAGE_NAME_RESERVED).not.toBe(INDEXED_DB_NAME)
  })
})
