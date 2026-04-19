import { Client as CrowdinClientCtor } from "@crowdin/crowdin-api-client";

import type { CrowdinEnv } from "./env.js";

// The SDK is CJS with both `exports.default = Client` and `exports.Client = Client`.
// Under Node 22+, the ESM-CJS interop resolves `import X from "cjs"` to the full
// `module.exports` namespace object rather than `exports.default`, so the default
// import is not a constructor. Use the named import, which resolves correctly.
export type CrowdinClient = InstanceType<typeof CrowdinClientCtor>;

export function createCrowdinClient(env: CrowdinEnv): CrowdinClient {
  return new CrowdinClientCtor({ token: env.token });
}
