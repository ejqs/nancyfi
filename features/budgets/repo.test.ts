import { beforeAll, describe, expect, test } from "bun:test"
import { Repo } from "@automerge/automerge-repo/slim"
import { DummyNetworkAdapter } from "@automerge/automerge-repo/helpers/DummyNetworkAdapter.js"
import { DummyStorageAdapter } from "@automerge/automerge-repo/helpers/DummyStorageAdapter.js"

import { createBudgetInRepo, findBudgetInRepo } from "./repo/budget-handles"
import { ensureAutomergeWasm } from "./repo/ensure-wasm"

beforeAll(async () => {
  await ensureAutomergeWasm()
})

describe("budget Automerge Repo helpers", () => {
  test("import preserves schema and survives storage round-trip", async () => {
    const storage = new DummyStorageAdapter()
    const network = new DummyNetworkAdapter({ startReady: true })
    const repo = new Repo({ storage, network: [network] })

    const handle = createBudgetInRepo(repo, {
      id: "budget-domain-1",
      name: "Probe",
      defaultCurrency: "PHP",
    })

    expect(handle.doc()?.schemaVersion).toBe(1)
    expect(handle.doc()?.name).toBe("Probe")
    expect(handle.doc()?.accountsById).toEqual({})

    handle.change((doc) => {
      doc.name = "Probe renamed"
    })

    await repo.flush([handle.documentId])

    const repo2 = new Repo({
      storage,
      network: [new DummyNetworkAdapter({ startReady: true })],
    })
    const reloaded = await findBudgetInRepo(repo2, handle.url)
    expect(reloaded.doc()?.name).toBe("Probe renamed")
    expect(reloaded.doc()?.id).toBe("budget-domain-1")
  })
})
