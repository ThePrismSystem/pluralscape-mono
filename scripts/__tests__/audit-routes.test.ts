import { describe, expect, it } from "vitest";

import { extractRouteMounts, parseRouteFile, resolveImportPath } from "../audit-routes.js";

describe("parseRouteFile", () => {
  it("extracts rate limit category from createCategoryRateLimiter call", () => {
    const source = `
import { createCategoryRateLimiter } from "../../middleware/rate-limit.js";
export const createRoute = new Hono<AuthEnv>();
createRoute.use("*", createCategoryRateLimiter("write"));
createRoute.post("/", async (c) => {});
`;
    const result = parseRouteFile(source, "create.ts");
    expect(result.rateLimitCategory).toBe("write");
  });

  it("extracts HTTP method and path from handler", () => {
    const source = `
export const createRoute = new Hono<AuthEnv>();
createRoute.post("/", async (c) => {});
`;
    const result = parseRouteFile(source, "create.ts");
    expect(result.methods).toEqual([{ method: "POST", path: "/" }]);
  });

  it("detects authMiddleware usage", () => {
    const source = `
import { authMiddleware } from "../../middleware/auth.js";
export const systemRoutes = new Hono<AuthEnv>();
systemRoutes.use("*", authMiddleware());
`;
    const result = parseRouteFile(source, "index.ts");
    expect(result.hasAuth).toBe(true);
  });

  it("detects parseJsonBody usage", () => {
    const source = `
import { parseJsonBody } from "../../lib/parse-json-body.js";
createRoute.post("/", async (c) => {
  const body = await parseJsonBody(c);
});
`;
    const result = parseRouteFile(source, "create.ts");
    expect(result.usesParseJsonBody).toBe(true);
  });

  it("detects validation schema imports", () => {
    const source = `
import { MemberListQuerySchema } from "@pluralscape/validation";
listRoute.get("/", async (c) => {});
`;
    const result = parseRouteFile(source, "list.ts");
    expect(result.validationSchemas).toEqual(["MemberListQuerySchema"]);
  });

  it("returns empty results for file with no handlers", () => {
    const source = `
import { Hono } from "hono";
export const routes = new Hono();
routes.route("/foo", fooRoute);
`;
    const result = parseRouteFile(source, "index.ts");
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
