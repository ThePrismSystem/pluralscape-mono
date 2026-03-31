import { describe, expect, it } from "vitest";

import { normalizeParamStyle, diffRoutes } from "../reconcile-openapi.js";

describe("normalizeParamStyle", () => {
  it("converts Express :param to OpenAPI {param}", () => {
    expect(normalizeParamStyle("/v1/systems/:systemId/members/:memberId")).toBe(
      "/v1/systems/{systemId}/members/{memberId}",
    );
  });

  it("leaves OpenAPI {param} unchanged", () => {
    expect(normalizeParamStyle("/v1/systems/{systemId}/members")).toBe(
      "/v1/systems/{systemId}/members",
    );
  });

  it("handles path with no params", () => {
    expect(normalizeParamStyle("/v1/health")).toBe("/v1/health");
  });

  it("handles adjacent params", () => {
    expect(normalizeParamStyle("/v1/:a/:b")).toBe("/v1/{a}/{b}");
  });
});

describe("diffRoutes", () => {
  it("returns empty when routes match", () => {
    const code = [{ method: "GET" as const, path: "/v1/health" }];
    const spec = [{ method: "GET" as const, path: "/v1/health" }];
    const result = diffRoutes(code, spec);
    expect(result.orphanedInSpec).toEqual([]);
    expect(result.undocumented).toEqual([]);
  });

  it("detects orphaned spec entries", () => {
    const code: { method: string; path: string }[] = [];
    const spec = [{ method: "GET" as const, path: "/v1/old-endpoint" }];
    const result = diffRoutes(code, spec);
    expect(result.orphanedInSpec).toEqual([{ method: "GET", path: "/v1/old-endpoint" }]);
    expect(result.undocumented).toEqual([]);
  });

  it("detects undocumented routes", () => {
    const code = [{ method: "POST" as const, path: "/v1/new-endpoint" }];
    const spec: { method: string; path: string }[] = [];
    const result = diffRoutes(code, spec);
    expect(result.orphanedInSpec).toEqual([]);
    expect(result.undocumented).toEqual([{ method: "POST", path: "/v1/new-endpoint" }]);
  });

  it("normalizes param styles before comparison", () => {
    const code = [{ method: "GET" as const, path: "/v1/systems/:systemId" }];
    const spec = [{ method: "GET" as const, path: "/v1/systems/{systemId}" }];
    const result = diffRoutes(code, spec);
    expect(result.orphanedInSpec).toEqual([]);
    expect(result.undocumented).toEqual([]);
  });

  it("method must match (same path different method is a mismatch)", () => {
    const code = [{ method: "POST" as const, path: "/v1/systems" }];
    const spec = [{ method: "GET" as const, path: "/v1/systems" }];
    const result = diffRoutes(code, spec);
    expect(result.orphanedInSpec).toHaveLength(1);
    expect(result.undocumented).toHaveLength(1);
  });
});
