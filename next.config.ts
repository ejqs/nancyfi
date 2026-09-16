import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Automerge WASM must not be resolved via Turbopack's virtual /ROOT fs paths.
  // App code uses `@automerge/*/slim` + `ensureAutomergeWasm()` (base64).
  serverExternalPackages: [
    "@automerge/automerge",
    "@automerge/automerge-repo",
  ],
};

export default nextConfig;
