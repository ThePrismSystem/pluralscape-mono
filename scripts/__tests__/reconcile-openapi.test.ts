import { describe, expect, it } from "vitest";

import {
  normalizeParamStyle,
  diffRoutes,
  parseSpecOperations,
  compareShapes,
} from "../reconcile-openapi.js";

import type { FieldShape } from "../reconcile-openapi.js";

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

describe("parseSpecOperations", () => {
  it("extracts method, path, and operationId from spec", () => {
    const spec = {
      paths: {
        "/v1/systems/{systemId}/members": {
          get: { operationId: "listMembers" },
          post: {
            operationId: "createMember",
            requestBody: {
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    required: ["encryptedData"],
                    properties: {
                      encryptedData: { type: "string" },
                    },
                  },
                },
              },
            },
          },
        },
      },
    };
    const ops = parseSpecOperations(spec);
    expect(ops).toHaveLength(2);
    expect(ops).toContainEqual({
      method: "GET",
      path: "/v1/systems/{systemId}/members",
      operationId: "listMembers",
      requestBodyShape: null,
    });
    expect(ops).toContainEqual({
      method: "POST",
      path: "/v1/systems/{systemId}/members",
      operationId: "createMember",
      requestBodyShape: {
        encryptedData: { type: "string", required: true },
      },
    });
  });

  it("handles $ref in requestBody schema by returning null shape", () => {
    const spec = {
      paths: {
        "/v1/auth/register": {
          post: {
            operationId: "register",
            requestBody: {
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/RegistrationRequest" },
                },
              },
            },
          },
        },
      },
    };
    const ops = parseSpecOperations(spec);
    expect(ops[0]?.requestBodyShape).toBeNull();
  });

  it("skips non-HTTP method keys (summary, description, parameters)", () => {
    const spec = {
      paths: {
        "/v1/health": {
          summary: "Health check",
          parameters: [],
          get: { operationId: "healthCheck" },
        },
      },
    };
    const ops = parseSpecOperations(spec);
    expect(ops).toHaveLength(1);
    expect(ops[0]?.method).toBe("GET");
  });

  it("returns empty array for empty paths", () => {
    expect(parseSpecOperations({ paths: {} })).toEqual([]);
  });
});

describe("compareShapes", () => {
  it("returns no mismatches for identical shapes", () => {
    const a: Record<string, FieldShape> = {
      name: { type: "string", required: true },
      age: { type: "number", required: false },
    };
    const b: Record<string, FieldShape> = {
      name: { type: "string", required: true },
      age: { type: "number", required: false },
    };
    const result = compareShapes(a, b);
    expect(result).toEqual([]);
  });

  it("detects missing field in spec", () => {
    const code: Record<string, FieldShape> = {
      name: { type: "string", required: true },
      bio: { type: "string", required: false },
    };
    const spec: Record<string, FieldShape> = {
      name: { type: "string", required: true },
    };
    const result = compareShapes(code, spec);
    expect(result).toContainEqual({
      field: "bio",
      issue: "missing_in_spec",
      codeType: "string",
      specType: null,
    });
  });

  it("detects extra field in spec", () => {
    const code: Record<string, FieldShape> = {
      name: { type: "string", required: true },
    };
    const spec: Record<string, FieldShape> = {
      name: { type: "string", required: true },
      legacy: { type: "string", required: false },
    };
    const result = compareShapes(code, spec);
    expect(result).toContainEqual({
      field: "legacy",
      issue: "extra_in_spec",
      codeType: null,
      specType: "string",
    });
  });

  it("detects type mismatch", () => {
    const code: Record<string, FieldShape> = {
      count: { type: "string", required: true },
    };
    const spec: Record<string, FieldShape> = {
      count: { type: "integer", required: true },
    };
    const result = compareShapes(code, spec);
    expect(result).toContainEqual({
      field: "count",
      issue: "type_mismatch",
      codeType: "string",
      specType: "integer",
    });
  });

  it("detects required/optional mismatch", () => {
    const code: Record<string, FieldShape> = {
      name: { type: "string", required: true },
    };
    const spec: Record<string, FieldShape> = {
      name: { type: "string", required: false },
    };
    const result = compareShapes(code, spec);
    expect(result).toContainEqual({
      field: "name",
      issue: "required_mismatch",
      codeType: "string",
      specType: "string",
    });
  });

  it("returns empty for two empty shapes", () => {
    expect(compareShapes({}, {})).toEqual([]);
  });
});
