import { createRequire } from "node:module";

import { describe, expect, it, vi } from "vitest";

interface ResolutionContext {
  readonly originModulePath: string;
  readonly resolveRequest: ReturnType<typeof vi.fn>;
}

interface MetroConfig {
  readonly resolver: {
    readonly resolveRequest: (
      context: ResolutionContext,
      moduleName: string,
      platform: string,
    ) => unknown;
  };
}

const WORKSPACE_ORIGIN = "/repo/apps/mobile/src/screens/home.tsx";
const PACKAGE_ORIGIN = "/repo/node_modules/.pnpm/some-package/node_modules/some-package/index.js";

function resolve(originModulePath: string, moduleName: string): unknown {
  const require = createRequire(import.meta.url);
  const config = require("../../metro.config.cjs") as MetroConfig;
  const resolveRequest = vi.fn();
  config.resolver.resolveRequest({ originModulePath, resolveRequest }, moduleName, "ios");
  return resolveRequest.mock.calls[0]?.[1];
}

describe("metro resolver", () => {
  it("drops the .js extension from relative imports in workspace source", () => {
    expect(resolve(WORKSPACE_ORIGIN, "../lib/logger.js")).toBe("../lib/logger");
  });

  it("leaves relative imports inside published packages as written", () => {
    expect(resolve(PACKAGE_ORIGIN, "./util.js")).toBe("./util.js");
  });

  it("leaves package imports from workspace source as written", () => {
    expect(resolve(WORKSPACE_ORIGIN, "some-package/dist/index.js")).toBe(
      "some-package/dist/index.js",
    );
  });

  it("leaves relative imports without a .js extension as written", () => {
    expect(resolve(WORKSPACE_ORIGIN, "./data.json")).toBe("./data.json");
  });
});
