import { TRPCError } from "@trpc/server";
import { describe, expect, it } from "vitest";
import { z } from "zod/v4";

import { ApiHttpError } from "../../lib/api-error.js";
import { errorMapProcedure } from "../../trpc/error-mapper.js";
import { createCallerFactory, router } from "../../trpc/trpc.js";

import type { AuditWriter } from "../../lib/audit-writer.js";
import type { TRPCContext } from "../../trpc/context.js";

const noopAuditWriter: AuditWriter = () => Promise.resolve();

/**
 * Helper: build a caller whose single procedure throws the given error.
 * The errorMapProcedure wraps it, so the thrown error should be mapped.
 */
function callerThatThrows(error: unknown) {
  const appRouter = router({
    fail: errorMapProcedure.query(() => {
      throw error;
    }),
  });
  const createCaller = createCallerFactory(appRouter);
  return createCaller({
    db: {} as TRPCContext["db"],
    auth: null,
    createAudit: () => noopAuditWriter,
    requestMeta: { ipAddress: null, userAgent: null },
  });
}

describe("error-mapper middleware", () => {
  it("maps ApiHttpError 404 to NOT_FOUND", async () => {
    const caller = callerThatThrows(new ApiHttpError(404, "NOT_FOUND", "Member not found"));
    await expect(caller.fail()).rejects.toThrow(
      expect.objectContaining({ code: "NOT_FOUND", message: "Member not found" }),
    );
  });

  it("maps ApiHttpError 409 to CONFLICT", async () => {
    const caller = callerThatThrows(new ApiHttpError(409, "CONFLICT", "Version mismatch"));
    await expect(caller.fail()).rejects.toThrow(
      expect.objectContaining({ code: "CONFLICT", message: "Version mismatch" }),
    );
  });

  it("maps ApiHttpError 403 to FORBIDDEN", async () => {
    const caller = callerThatThrows(new ApiHttpError(403, "FORBIDDEN", "Access denied"));
    await expect(caller.fail()).rejects.toThrow(
      expect.objectContaining({ code: "FORBIDDEN", message: "Access denied" }),
    );
  });

  it("maps ApiHttpError 400 to BAD_REQUEST", async () => {
    const caller = callerThatThrows(new ApiHttpError(400, "VALIDATION_ERROR", "Invalid input"));
    await expect(caller.fail()).rejects.toThrow(
      expect.objectContaining({ code: "BAD_REQUEST", message: "Invalid input" }),
    );
  });

  it("maps ApiHttpError 429 to TOO_MANY_REQUESTS", async () => {
    const caller = callerThatThrows(new ApiHttpError(429, "RATE_LIMITED", "Slow down"));
    await expect(caller.fail()).rejects.toThrow(
      expect.objectContaining({ code: "TOO_MANY_REQUESTS", message: "Slow down" }),
    );
  });

  it("maps ZodError to BAD_REQUEST", async () => {
    const zodResult = z.object({ name: z.string() }).safeParse({});
    const caller = callerThatThrows(zodResult.error);
    await expect(caller.fail()).rejects.toThrow(expect.objectContaining({ code: "BAD_REQUEST" }));
  });

  it("maps ValidationError (by name) to BAD_REQUEST", async () => {
    const error = new Error("Recovery key backup must be confirmed");
    error.name = "ValidationError";
    const caller = callerThatThrows(error);
    await expect(caller.fail()).rejects.toThrow(
      expect.objectContaining({
        code: "BAD_REQUEST",
        message: "Recovery key backup must be confirmed",
      }),
    );
  });

  it("maps unknown errors to INTERNAL_SERVER_ERROR", async () => {
    const caller = callerThatThrows(new Error("Something broke"));
    await expect(caller.fail()).rejects.toThrow(
      expect.objectContaining({ code: "INTERNAL_SERVER_ERROR" }),
    );
  });

  it("passes through TRPCError unchanged", async () => {
    const caller = callerThatThrows(
      new TRPCError({ code: "UNAUTHORIZED", message: "Auth required" }),
    );
    await expect(caller.fail()).rejects.toThrow(
      expect.objectContaining({ code: "UNAUTHORIZED", message: "Auth required" }),
    );
  });

  it("maps ApiHttpError 413 to PAYLOAD_TOO_LARGE", async () => {
    const caller = callerThatThrows(new ApiHttpError(413, "BLOB_TOO_LARGE", "File too large"));
    await expect(caller.fail()).rejects.toThrow(
      expect.objectContaining({ code: "PAYLOAD_TOO_LARGE", message: "File too large" }),
    );
  });

  it("maps ApiHttpError with unmapped status to INTERNAL_SERVER_ERROR", async () => {
    const caller = callerThatThrows(new ApiHttpError(500, "NOT_FOUND", "DB down"));
    await expect(caller.fail()).rejects.toThrow(
      expect.objectContaining({ code: "INTERNAL_SERVER_ERROR" }),
    );
  });

  it("maps non-Error throwable to INTERNAL_SERVER_ERROR", async () => {
    const caller = callerThatThrows("a raw string error");
    await expect(caller.fail()).rejects.toThrow(
      expect.objectContaining({ code: "INTERNAL_SERVER_ERROR" }),
    );
  });
});
