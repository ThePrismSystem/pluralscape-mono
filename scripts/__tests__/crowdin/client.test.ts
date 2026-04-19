import { describe, expect, it } from "vitest";

import { createCrowdinClient } from "../../crowdin/client.js";
import type { CrowdinEnv } from "../../crowdin/env.js";

// Regression test for: the Crowdin SDK ships as CJS with both
// `exports.default = Client` and `exports.Client = Client`. Under Node 22+
// the ESM-CJS interop resolves `import X from "cjs"` to the full
// `module.exports` namespace object rather than `exports.default`, so a
// default import is NOT a constructor. This test executes the real
// constructor path so a regression (e.g. someone flipping back to a default
// import) surfaces immediately instead of only in the Crowdin CI step.
describe("createCrowdinClient", () => {
  it("constructs a real Client instance (not the SDK namespace object)", () => {
    const env = {
      projectId: 1,
      token: "fake-token-for-unit-test",
    } as CrowdinEnv;

    const client = createCrowdinClient(env);

    expect(client.constructor.name).toBe("Client");
    expect(typeof client.projectsGroupsApi).toBe("object");
    expect(typeof client.glossariesApi).toBe("object");
  });
});
