import { describe, expect, it } from "vitest";

import type {
  ParityFailure,
  RESTRouteInfo,
  TRPCProcedureInfo,
} from "../../../scripts/trpc-parity-lib.js";
import {
  deriveRouterPrefix,
  extractBalancedBlock,
  inferAuthLevelFromMiddlewares,
  normalizePath,
  resolveMapping,
  runParityChecks,
  walkRouteTree,
} from "../../../scripts/trpc-parity-lib.js";

describe("extractBalancedBlock", () => {
  it("extracts simple balanced braces", () => {
    expect(extractBalancedBlock("{ a: 1 }", 0)).toBe(" a: 1 ");
  });

  it("returns null when index is not an opening brace", () => {
    expect(extractBalancedBlock("abc", 0)).toBeNull();
  });

  it("returns null for unbalanced braces", () => {
    expect(extractBalancedBlock("{ a: {", 0)).toBeNull();
  });

  it("handles nested braces", () => {
    expect(extractBalancedBlock("{ a: { b: 1 } }", 0)).toBe(" a: { b: 1 } ");
  });

  it("ignores braces inside double-quoted strings", () => {
    expect(extractBalancedBlock('{ msg: "use { carefully }" }', 0)).toBe(
      ' msg: "use { carefully }" ',
    );
  });

  it("ignores braces inside single-quoted strings", () => {
    expect(extractBalancedBlock("{ msg: 'test { brace }' }", 0)).toBe(" msg: 'test { brace }' ");
  });

  it("ignores braces inside template literals", () => {
    expect(extractBalancedBlock("{ msg: `${a} and {b}` }", 0)).toBe(" msg: `${a} and {b}` ");
  });

  it("ignores braces inside single-line comments", () => {
    expect(extractBalancedBlock("{ a: 1, // { not a brace\nb: 2 }", 0)).toBe(
      " a: 1, // { not a brace\nb: 2 ",
    );
  });

  it("ignores braces inside multi-line comments", () => {
    expect(extractBalancedBlock("{ a: 1, /* { not } a { brace */ b: 2 }", 0)).toBe(
      " a: 1, /* { not } a { brace */ b: 2 ",
    );
  });
});

describe("runParityChecks", () => {
  it("records failure when REST has rate limit but tRPC does not", () => {
    const restRoutes: RESTRouteInfo[] = [
      {
        routeKey: "GET /v1/systems/:systemId/members",
        method: "GET",
        fullPath: "/v1/systems/:systemId/members",
        rateLimitCategory: "readDefault",
        scope: null,
        authLevel: "system",
        hasInputValidation: true,
        hasIdempotency: false,
        sourceFile: "test.ts",
      },
    ];
    const trpcProcedures = new Map<string, TRPCProcedureInfo>([
      [
        "member.list",
        {
          path: "member.list",
          type: "query",
          rateLimitCategory: null,
          scope: null,
          authLevel: "system",
          hasInputValidation: true,
        },
      ],
    ]);
    const result = runParityChecks(restRoutes, trpcProcedures);
    expect(result.failures.some((f) => f.dimension === "rate-limit")).toBe(true);
    expect(result.warnings.filter((w) => w.dimension === "rate-limit")).toHaveLength(0);
  });

  it("records failure when rate limit categories differ", () => {
    const restRoutes: RESTRouteInfo[] = [
      {
        routeKey: "GET /v1/systems/:systemId/members",
        method: "GET",
        fullPath: "/v1/systems/:systemId/members",
        rateLimitCategory: "readDefault",
        scope: null,
        authLevel: "system",
        hasInputValidation: true,
        hasIdempotency: false,
        sourceFile: "test.ts",
      },
    ];
    const trpcProcedures = new Map<string, TRPCProcedureInfo>([
      [
        "member.list",
        {
          path: "member.list",
          type: "query",
          rateLimitCategory: "readHeavy",
          scope: null,
          authLevel: "system",
          hasInputValidation: true,
        },
      ],
    ]);
    const result = runParityChecks(restRoutes, trpcProcedures);
    expect(result.failures.some((f) => f.dimension === "rate-limit")).toBe(true);
  });

  it("passes when rate limit categories match", () => {
    const restRoutes: RESTRouteInfo[] = [
      {
        routeKey: "GET /v1/systems/:systemId/members",
        method: "GET",
        fullPath: "/v1/systems/:systemId/members",
        rateLimitCategory: "readDefault",
        scope: null,
        authLevel: "system",
        hasInputValidation: true,
        hasIdempotency: false,
        sourceFile: "test.ts",
      },
    ];
    const trpcProcedures = new Map<string, TRPCProcedureInfo>([
      [
        "member.list",
        {
          path: "member.list",
          type: "query",
          rateLimitCategory: "readDefault",
          scope: null,
          authLevel: "system",
          hasInputValidation: true,
        },
      ],
    ]);
    const result = runParityChecks(restRoutes, trpcProcedures);
    expect(result.failures.filter((f) => f.dimension === "rate-limit")).toHaveLength(0);
  });
});

describe("walkRouteTree", () => {
  it("records a failure when a route file cannot be read", () => {
    const failures: ParityFailure[] = [];
    const result = walkRouteTree("/nonexistent/file.ts", "/v1", false, failures);
    expect(result).toEqual([]);
    expect(failures).toHaveLength(1);
    expect(failures[0]?.dimension).toBe("existence");
    expect(failures[0]?.actual).toContain("not readable");
  });
});

describe("inferAuthLevelFromMiddlewares", () => {
  it("returns 'system' when middleware checks ownedSystemIds", () => {
    const mws = [{ toString: () => "ctx.auth.ownedSystemIds.has(systemId)" }];
    expect(inferAuthLevelFromMiddlewares(mws)).toBe("system");
  });

  it("returns 'protected' when middleware checks ctx.auth + UNAUTHORIZED", () => {
    const mws = [
      { toString: () => 'if (!ctx.auth) throw new TRPCError({ code: "UNAUTHORIZED" })' },
    ];
    expect(inferAuthLevelFromMiddlewares(mws)).toBe("protected");
  });

  it("returns 'public' when no auth middleware detected", () => {
    const mws = [{ toString: () => "return next()" }];
    expect(inferAuthLevelFromMiddlewares(mws)).toBe("public");
  });

  it("returns 'system' over 'protected' when both patterns present", () => {
    const mws = [
      { toString: () => 'if (!ctx.auth) throw new TRPCError({ code: "UNAUTHORIZED" })' },
      { toString: () => "ctx.auth.ownedSystemIds.has(systemId)" },
    ];
    expect(inferAuthLevelFromMiddlewares(mws)).toBe("system");
  });
});

describe("resolveMapping", () => {
  it("returns tRPC path for known REST route", () => {
    expect(resolveMapping("POST /v1/auth/register")).toBe("auth.register");
  });

  it("returns null for unknown REST route", () => {
    expect(resolveMapping("GET /v1/unknown/endpoint")).toBeNull();
  });

  it("returns tRPC path for system-scoped routes", () => {
    expect(resolveMapping("POST /v1/systems/:systemId/members")).toBe("member.create");
  });
});

describe("normalizePath", () => {
  it("collapses double slashes", () => {
    expect(normalizePath("/v1//members")).toBe("/v1/members");
  });

  it("removes trailing slash", () => {
    expect(normalizePath("/v1/members/")).toBe("/v1/members");
  });

  it("returns / for empty input", () => {
    expect(normalizePath("")).toBe("/");
  });
});

describe("deriveRouterPrefix", () => {
  it("strips .ts extension", () => {
    expect(deriveRouterPrefix("member.ts")).toBe("member");
  });

  it("converts kebab-case to camelCase", () => {
    expect(deriveRouterPrefix("board-message.ts")).toBe("boardMessage");
  });

  it("handles multi-hyphen names", () => {
    expect(deriveRouterPrefix("check-in-record.ts")).toBe("checkInRecord");
  });
});
