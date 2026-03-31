import { readFileSync } from "node:fs";

import { describe, expect, it, vi } from "vitest";

import {
  buildInventory,
  extractRouteMounts,
  normalizePath,
  parseRouteFile,
  resolveImportPath,
} from "../audit-routes.js";

vi.mock("node:fs");

describe("parseRouteFile", () => {
  it("extracts rate limit category from createCategoryRateLimiter call", () => {
    const source = `
import { createCategoryRateLimiter } from "../../middleware/rate-limit.js";
export const createRoute = new Hono<AuthEnv>();
createRoute.use("*", createCategoryRateLimiter("write"));
createRoute.post("/", async (c) => {});
`;
    const result = parseRouteFile(source);
    expect(result.rateLimitCategory).toBe("write");
  });

  it("extracts HTTP method and path from handler", () => {
    const source = `
export const createRoute = new Hono<AuthEnv>();
createRoute.post("/", async (c) => {});
`;
    const result = parseRouteFile(source);
    expect(result.methods).toEqual([{ method: "POST", path: "/" }]);
  });

  it("detects authMiddleware usage", () => {
    const source = `
import { authMiddleware } from "../../middleware/auth.js";
export const systemRoutes = new Hono<AuthEnv>();
systemRoutes.use("*", authMiddleware());
`;
    const result = parseRouteFile(source);
    expect(result.hasAuth).toBe(true);
  });

  it("detects parseJsonBody usage", () => {
    const source = `
import { parseJsonBody } from "../../lib/parse-json-body.js";
createRoute.post("/", async (c) => {
  const body = await parseJsonBody(c);
});
`;
    const result = parseRouteFile(source);
    expect(result.usesParseJsonBody).toBe(true);
  });

  it("detects validation schema imports", () => {
    const source = `
import { MemberListQuerySchema } from "@pluralscape/validation";
listRoute.get("/", async (c) => {});
`;
    const result = parseRouteFile(source);
    expect(result.validationSchemas).toEqual(["MemberListQuerySchema"]);
  });

  it("returns empty results for file with no handlers", () => {
    const source = `
import { Hono } from "hono";
export const routes = new Hono();
routes.route("/foo", fooRoute);
`;
    const result = parseRouteFile(source);
    expect(result.methods).toEqual([]);
    expect(result.rateLimitCategory).toBeNull();
  });
});

describe("extractRouteMounts", () => {
  it("extracts route mounts from index file", () => {
    const source = `
import { Hono } from "hono";
export const v1Routes = new Hono();
v1Routes.route("/account", accountRoutes);
v1Routes.route("/auth", authRoutes);
`;
    const mounts = extractRouteMounts(source);
    expect(mounts).toEqual([
      { path: "/account", variableName: "accountRoutes" },
      { path: "/auth", variableName: "authRoutes" },
    ]);
  });

  it("extracts mounts with systemId param", () => {
    const source = `
systemRoutes.route("/:systemId/members", memberRoutes);
systemRoutes.route("/:systemId/groups", groupRoutes);
`;
    const mounts = extractRouteMounts(source);
    expect(mounts).toEqual([
      { path: "/:systemId/members", variableName: "memberRoutes" },
      { path: "/:systemId/groups", variableName: "groupRoutes" },
    ]);
  });

  it("extracts mounts with root path", () => {
    const source = `
systemRoutes.route("/", listRoute);
systemRoutes.route("/", getRoute);
`;
    const mounts = extractRouteMounts(source);
    expect(mounts).toEqual([
      { path: "/", variableName: "listRoute" },
      { path: "/", variableName: "getRoute" },
    ]);
  });
});

describe("resolveImportPath", () => {
  it("resolves relative import to absolute path", () => {
    const source = `
import { memberRoutes } from "../members/index.js";
import { groupRoutes } from "../groups/index.js";
`;
    const result = resolveImportPath(
      source,
      "memberRoutes",
      "/home/user/project/apps/api/src/routes/systems/index.ts",
    );
    expect(result).toBe("/home/user/project/apps/api/src/routes/members/index.ts");
  });

  it("resolves .js extension to .ts", () => {
    const source = `import { createRoute } from "./create.js";`;
    const result = resolveImportPath(
      source,
      "createRoute",
      "/home/user/project/apps/api/src/routes/systems/index.ts",
    );
    expect(result).toBe("/home/user/project/apps/api/src/routes/systems/create.ts");
  });

  it("returns null for unresolvable import", () => {
    const source = `import { Hono } from "hono";`;
    const result = resolveImportPath(
      source,
      "memberRoutes",
      "/home/user/project/apps/api/src/routes/systems/index.ts",
    );
    expect(result).toBeNull();
  });
});

describe("normalizePath", () => {
  it("collapses double slashes", () => {
    expect(normalizePath("/v1//account")).toBe("/v1/account");
  });

  it("strips trailing slash", () => {
    expect(normalizePath("/v1/account/")).toBe("/v1/account");
  });

  it("preserves root path", () => {
    expect(normalizePath("/")).toBe("/");
  });

  it("handles multiple consecutive slashes", () => {
    expect(normalizePath("/v1///account///get")).toBe("/v1/account/get");
  });
});

describe("buildInventory", () => {
  it("returns entries for a simple route file", () => {
    const fakeSource = `
import { createCategoryRateLimiter } from "../../middleware/rate-limit.js";
export const route = new Hono();
route.use("*", createCategoryRateLimiter("write"));
route.post("/", async (c) => {});
`;
    vi.mocked(readFileSync).mockReturnValue(fakeSource);
    const entries = buildInventory("/fake/route.ts", "/v1/test", false);
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      fullPath: "/v1/test",
      method: "POST",
      hasAuth: false,
      rateLimitCategory: "write",
      sourceFile: "/fake/route.ts",
    });
  });

  it("inherits auth from parent", () => {
    const fakeSource = `
export const route = new Hono();
route.get("/status", async (c) => {});
`;
    vi.mocked(readFileSync).mockReturnValue(fakeSource);
    const entries = buildInventory("/fake/route.ts", "/v1/account", true);
    expect(entries[0]?.hasAuth).toBe(true);
  });

  it("resolves recursive mounts", () => {
    const indexSource = `
import { childRoute } from "./child.js";
export const routes = new Hono();
routes.route("/child", childRoute);
`;
    const childSource = `
export const childRoute = new Hono();
childRoute.get("/", async (c) => {});
`;
    vi.mocked(readFileSync).mockImplementation((path: unknown) => {
      if (String(path).includes("child")) return childSource;
      return indexSource;
    });

    const entries = buildInventory("/fake/index.ts", "/v1", false);
    expect(entries).toHaveLength(1);
    expect(entries[0]?.fullPath).toBe("/v1/child");
  });

  it("skips ENOENT errors for missing files", () => {
    const indexSource = `
import { missingRoute } from "./missing.js";
export const routes = new Hono();
routes.route("/missing", missingRoute);
`;
    vi.mocked(readFileSync).mockImplementation((path: unknown) => {
      if (String(path).includes("missing")) {
        const err = new Error("ENOENT") as NodeJS.ErrnoException;
        err.code = "ENOENT";
        throw err;
      }
      return indexSource;
    });

    const entries = buildInventory("/fake/index.ts", "/v1", false);
    expect(entries).toHaveLength(0);
  });

  it("re-throws non-ENOENT errors", () => {
    const indexSource = `
import { badRoute } from "./bad.js";
export const routes = new Hono();
routes.route("/bad", badRoute);
`;
    vi.mocked(readFileSync).mockImplementation((path: unknown) => {
      if (String(path).includes("bad")) {
        throw new Error("Permission denied");
      }
      return indexSource;
    });

    expect(() => buildInventory("/fake/index.ts", "/v1", false)).toThrow("Permission denied");
  });
});
