/**
 * Tests for the tRPC errorFormatter configured in trpc.ts.
 *
 * The errorFormatter only runs during HTTP serialization, not for
 * server-side callers. We test it via fetchRequestHandler round-trips.
 */
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { describe, expect, it } from "vitest";
import { z } from "zod/v4";

import { publicProcedure, router } from "../../trpc/trpc.js";

import type { AuditWriter } from "../../lib/audit-writer.js";
import type { TRPCContext } from "../../trpc/context.js";

const noopAuditWriter: AuditWriter = () => Promise.resolve();

function makeContext(): TRPCContext {
  return {
    db: {} as TRPCContext["db"],
    auth: null,
    createAudit: () => noopAuditWriter,
    requestMeta: { ipAddress: null, userAgent: null },
  };
}

interface TRPCResponseData {
  zodError?: unknown;
  stack?: string;
}

interface TRPCResponseError {
  data?: TRPCResponseData;
  code: number;
}

interface TRPCResponse {
  error?: TRPCResponseError;
}

/** Helper: send a tRPC request through fetchRequestHandler and parse the JSON response. */
async function fetchTRPC(
  testRouter: ReturnType<typeof router>,
  path: string,
  input?: unknown,
): Promise<TRPCResponse> {
  const url = input
    ? `http://localhost/trpc/${path}?input=${encodeURIComponent(JSON.stringify(input))}`
    : `http://localhost/trpc/${path}`;

  const response = await fetchRequestHandler({
    endpoint: "/trpc",
    req: new Request(url),
    router: testRouter,
    createContext: () => Promise.resolve(makeContext()),
  });

  const body: unknown = await response.json();
  // Batch response is an array, single response is an object
  const result = Array.isArray(body) ? body[0] : body;
  return result as TRPCResponse;
}

describe("errorFormatter", () => {
  const testRouter = router({
    validated: publicProcedure
      .input(z.object({ name: z.string(), age: z.number().int().min(0) }))
      .query(({ input }) => input),
    failing: publicProcedure.query(() => {
      throw new Error("boom");
    }),
  });

  it("includes zodError tree for Zod validation failures", async () => {
    const result = await fetchTRPC(testRouter, "validated", {});

    expect(result.error).toBeDefined();
    expect(result.error?.data?.zodError).not.toBeNull();
    expect(result.error?.data?.zodError).toBeDefined();
    // zodError should be a tree with properties for the missing fields
    const zodError = result.error?.data?.zodError;
    expect(zodError).toSatisfy(
      (v: unknown): v is Record<string, unknown> =>
        typeof v === "object" && v !== null && "properties" in v,
    );
  });

  it("sets zodError to null for non-Zod errors", async () => {
    const result = await fetchTRPC(testRouter, "failing");

    expect(result.error).toBeDefined();
    expect(result.error?.data?.zodError).toBeNull();
  });

  it("does not include stack traces when isDev is false", async () => {
    // NODE_ENV is "test" in vitest, so isDev = false
    const result = await fetchTRPC(testRouter, "failing");

    expect(result.error).toBeDefined();
    expect(result.error?.data?.stack).toBeUndefined();
  });
});
