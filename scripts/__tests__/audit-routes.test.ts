import { describe, expect, it } from "vitest";

import { parseRouteFile } from "../audit-routes.js";

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
