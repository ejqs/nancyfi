/**
 * Regenerate `features/budgets/schema-init.ts`.
 * Commit the new bytes when intentionally changing schema v1 init.
 */
import * as Automerge from "@automerge/automerge/slim"
import { writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

import { ensureAutomergeWasm } from "../repo/ensure-wasm"

await ensureAutomergeWasm()

const SCHEMA_ACTOR = "00000000000000000000000000000000"

let doc = Automerge.init<Record<string, unknown>>({ actor: SCHEMA_ACTOR })
doc = Automerge.change(doc, { time: 0, message: "budget-schema-v1" }, (d) => {
  d.schemaVersion = 1
  d.id = ""
  d.name = ""
  d.timezone = "UTC"
  d.defaultCurrency = "PHP"
  d.accountsById = {}
  d.entriesById = {}
  d.plansById = {}
  d.planTemplatesById = {}
  d.rulesAppliedById = {}
  d.ruleRunsById = {}
})

const bytes = Automerge.save(doc)
const outPath = join(dirname(fileURLToPath(import.meta.url)), "..", "schema-init.ts")

const body = `/**
 * Hard-coded Automerge change that initializes Budget schema v1.
 * All new budgets load these bytes so peers share ancestry.
 *
 * Regenerate with: bun features/budgets/scripts/generate-schema-init.ts
 * Do not invent bytes by hand.
 */
export const BUDGET_SCHEMA_V1_INIT_BYTES = new Uint8Array([
  ${[...bytes].join(", ")}
])
`

writeFileSync(outPath, body)
console.log(`Wrote ${bytes.length} bytes to ${outPath}`)
