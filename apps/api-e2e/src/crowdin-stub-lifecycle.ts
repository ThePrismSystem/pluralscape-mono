import { startCrowdinStub, type CrowdinStub } from "./fixtures/crowdin-ota-stub.js";

import type { CrowdinStubFixtures } from "./fixtures/crowdin-ota-stub.js";

/**
 * Fixed distribution hash used throughout the E2E suite. Matches the stub's
 * served paths and is injected into the API process as
 * `CROWDIN_DISTRIBUTION_HASH` so `getI18nDeps()` resolves successfully.
 */
export const E2E_CROWDIN_HASH = "e2e-hash";

/**
 * Canonical fixture data for the E2E stub. Tests import this to know what
 * translations to assert against. Manifest timestamp is arbitrary but stable
 * so snapshot assertions remain deterministic.
 */
const FIXTURE_TIMESTAMP = 1_700_000_000;

/** Injected status when the upstream-failure test requests `force5xx/broken`. */
const FORCED_UPSTREAM_ERROR_STATUS = 500;

export const E2E_CROWDIN_FIXTURES: CrowdinStubFixtures = {
  distributionHash: E2E_CROWDIN_HASH,
  manifest: {
    timestamp: FIXTURE_TIMESTAMP,
    content: {
      en: ["common.json", "auth.json"],
      es: ["common.json"],
    },
  },
  namespaces: {
    "en/common": { hello: "Hello" },
    "en/auth": { login: "Log in" },
    "es/common": { hello: "Hola" },
  },
  // Tests route specific locale/namespace pairs through the 5xx failure
  // branch by requesting a path that hits this override. `force5xx` is
  // served by the stub as a 5xx, which the API must map to 502
  // UPSTREAM_UNAVAILABLE.
  upstreamStatusFor: (pathname: string): number | undefined => {
    if (pathname === `/${E2E_CROWDIN_HASH}/content/force5xx/broken.json`) {
      return FORCED_UPSTREAM_ERROR_STATUS;
    }
    return undefined;
  },
};

/**
 * Module-level holder so `global-setup.ts` and `global-teardown.ts` can share
 * the stub instance. Playwright runs both in the same Node process, so a
 * module-level variable loaded by both is sufficient.
 */
let activeStub: CrowdinStub | null = null;

export async function startE2ECrowdinStub(): Promise<CrowdinStub> {
  if (activeStub !== null) return activeStub;
  activeStub = await startCrowdinStub(E2E_CROWDIN_FIXTURES);
  return activeStub;
}

export async function stopE2ECrowdinStub(): Promise<void> {
  if (activeStub === null) return;
  const stub = activeStub;
  activeStub = null;
  await stub.close();
}
