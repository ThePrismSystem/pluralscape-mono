import CrowdinClientCtor from "@crowdin/crowdin-api-client";

import type { CrowdinEnv } from "./env.js";

// The SDK ships as a CJS module; the ESM default import resolves directly to
// the constructor class (confirmed at runtime: `typeof import === "function"`).
export type CrowdinClient = InstanceType<typeof CrowdinClientCtor>;

export function createCrowdinClient(env: CrowdinEnv): CrowdinClient {
  return new CrowdinClientCtor({ token: env.token });
}
