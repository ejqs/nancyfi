import {
  initializeBase64Wasm,
  isWasmInitialized,
} from "@automerge/automerge/slim"
import { automergeWasmBase64 } from "@automerge/automerge/automerge.wasm.base64"

let pending: Promise<void> | null = null

/**
 * Turbopack/Next cannot reliably load Automerge's nodejs `.wasm` path
 * (`/ROOT/node_modules/...`). Initialize from the embedded base64 blob instead.
 */
export async function ensureAutomergeWasm(): Promise<void> {
  if (isWasmInitialized()) return
  if (!pending) {
    pending = initializeBase64Wasm(automergeWasmBase64)
  }
  await pending
}
