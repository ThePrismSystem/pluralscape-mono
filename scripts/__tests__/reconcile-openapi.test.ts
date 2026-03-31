import { describe, expect, it } from "vitest";

import {
  normalizeParamStyle,
  diffRoutes,
  parseSpecOperations,
  compareShapes,
  extractInlineShape,
  formatHumanOutput,
  formatJsonOutput,
} from "../reconcile-openapi.js";

import type { FieldShape, ReconciliationReport, RouteKey } from "../reconcile-openapi.js";

describe("formatHumanOutput", () => {
  it("reports clean state when no discrepancies", () => {
    const report: ReconciliationReport = {
      orphanedInSpec: [],
      undocumented: [],
      shapeMismatches: [],
      totalCodeRoutes: 304,
      totalSpecOperations: 304,
    };
    const output = formatHumanOutput(report);
    expect(output).toContain("No discrepancies found");
    expect(output).toContain("304");
  });

  it("lists orphaned spec entries", () => {
    const report: ReconciliationReport = {
      orphanedInSpec: [{ method: "GET", path: "/v1/old" }],
      undocumented: [],
      shapeMismatches: [],
      totalCodeRoutes: 10,
      totalSpecOperations: 11,
    };
    const output = formatHumanOutput(report);
    expect(output).toContain("Orphaned");
    expect(output).toContain("GET /v1/old");
  });

  it("lists undocumented routes", () => {
    const report: ReconciliationReport = {
      orphanedInSpec: [],
      undocumented: [{ method: "POST", path: "/v1/new" }],
      shapeMismatches: [],
      totalCodeRoutes: 11,
      totalSpecOperations: 10,
    };
    const output = formatHumanOutput(report);
    expect(output).toContain("Undocumented");
    expect(output).toContain("POST /v1/new");
  });

  it("lists shape mismatches", () => {
    const report: ReconciliationReport = {
      orphanedInSpec: [],
      undocumented: [],
      shapeMismatches: [
        {
          method: "POST",
          path: "/v1/members",
          mismatches: [
            { field: "bio", issue: "missing_in_spec", codeType: "string", specType: null },
          ],
        },
      ],
      totalCodeRoutes: 10,
      totalSpecOperations: 10,
    };
    const output = formatHumanOutput(report);
    expect(output).toContain("Schema");
    expect(output).toContain("POST /v1/members");
    expect(output).toContain("bio");
  });
});

describe("formatJsonOutput", () => {
  it("returns valid JSON with all fields", () => {
    const report: ReconciliationReport = {
      orphanedInSpec: [{ method: "GET", path: "/v1/old" }],
      undocumented: [],
      shapeMismatches: [],
      totalCodeRoutes: 10,
      totalSpecOperations: 11,
    };
    const json = JSON.parse(formatJsonOutput(report)) as ReconciliationReport;
    expect(json.orphanedInSpec).toHaveLength(1);
    expect(json.undocumented).toHaveLength(0);
    expect(json.totalCodeRoutes).toBe(10);
  });

  it("includes shapeMismatches in JSON output", () => {
    const report: ReconciliationReport = {
      orphanedInSpec: [],
      undocumented: [],
      shapeMismatches: [
        {
          method: "POST",
          path: "/v1/members",
          mismatches: [
            { field: "bio", issue: "missing_in_spec", codeType: "string", specType: null },
          ],
        },
      ],
      totalCodeRoutes: 10,
      totalSpecOperations: 10,
    };
    const json = JSON.parse(formatJsonOutput(report)) as ReconciliationReport;
    expect(json.shapeMismatches).toHaveLength(1);
    expect(json.shapeMismatches[0]?.mismatches[0]?.field).toBe("bio");
  });
});

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
    const code: RouteKey[] = [];
    const spec = [{ method: "GET" as const, path: "/v1/old-endpoint" }];
    const result = diffRoutes(code, spec);
    expect(result.orphanedInSpec).toEqual([{ method: "GET", path: "/v1/old-endpoint" }]);
    expect(result.undocumented).toEqual([]);
  });

  it("detects undocumented routes", () => {
    const code = [{ method: "POST" as const, path: "/v1/new-endpoint" }];
    const spec: RouteKey[] = [];
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

  it("matches routes with different param names", () => {
    const code = [{ method: "POST" as const, path: "/v1/device-transfer/:id/approve" }];
    const spec = [{ method: "POST" as const, path: "/v1/device-transfer/{transferId}/approve" }];
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

describe("extractInlineShape", () => {
  it("extracts shape from simple object schema", () => {
    const schema = {
      type: "object",
      required: ["encryptedData"],
      properties: {
        encryptedData: { type: "string" },
        version: { type: "integer" },
      },
    };
    const shape = extractInlineShape(schema);
    expect(shape).toEqual({
      encryptedData: { type: "string", required: true },
      version: { type: "integer", required: false },
    });
  });

  it("merges allOf into a single shape", () => {
    const schema = {
      allOf: [
        {
          type: "object",
          required: ["a"],
          properties: { a: { type: "string" } },
        },
        {
          type: "object",
          required: ["b"],
          properties: { b: { type: "number" } },
        },
      ],
    };
    const shape = extractInlineShape(schema);
    expect(shape).toEqual({
      a: { type: "string", required: true },
      b: { type: "number", required: true },
    });
  });

  it("returns null for $ref schema", () => {
    expect(extractInlineShape({ $ref: "#/components/schemas/Foo" })).toBeNull();
  });

  it("returns null for non-object schema", () => {
    expect(extractInlineShape({ type: "string" })).toBeNull();
  });

  it("returns null when allOf contains a $ref sub-schema", () => {
    const schema = {
      allOf: [
        { type: "object", required: ["a"], properties: { a: { type: "string" } } },
        { $ref: "#/components/schemas/Foo" },
      ],
    };
    expect(extractInlineShape(schema)).toBeNull();
  });

  it("returns null for empty allOf", () => {
    expect(extractInlineShape({ allOf: [] })).toBeNull();
  });

  it("returns null when allOf contains a non-object entry", () => {
    const schema = { allOf: ["not-an-object"] };
    expect(extractInlineShape(schema)).toBeNull();
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
