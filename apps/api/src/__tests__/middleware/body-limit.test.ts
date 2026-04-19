import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { describe, expect, it } from "vitest";

import { HTTP_CONTENT_TOO_LARGE } from "../../http.constants.js";
import { ApiHttpError } from "../../lib/api-error.js";
import { errorHandler } from "../../middleware/error-handler.js";
import { BODY_SIZE_LIMIT_BYTES } from "../../middleware/middleware.constants.js";
import { requestIdMiddleware } from "../../middleware/request-id.js";

import type { ApiErrorResponse } from "@pluralscape/types";

function createApp(): Hono {
  const app = new Hono();
  app.use("*", requestIdMiddleware());
  app.use(
    "*",
    bodyLimit({
      maxSize: BODY_SIZE_LIMIT_BYTES,
      onError: () => {
        throw new ApiHttpError(
          HTTP_CONTENT_TOO_LARGE,
          "BLOB_TOO_LARGE",
          "Request body exceeds size limit",
        );
      },
    }),
  );
  app.onError(errorHandler);
  app.post("/test", (c) => c.json({ ok: true }));
  return app;
}

describe("body limit middleware", () => {
  it("returns 413 BLOB_TOO_LARGE with requestId for oversized body", async () => {
    const app = createApp();
    const oversizedBody = "x".repeat(BODY_SIZE_LIMIT_BYTES + 1);

    const res = await app.request("/test", {
      method: "POST",
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Length": String(oversizedBody.length),
      },
      body: oversizedBody,
    });

    expect(res.status).toBe(413);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("BLOB_TOO_LARGE");
    expect(body.error.message).toBe("Request body exceeds size limit");
    expect(typeof body.requestId).toBe("string");
  });

  it("returns 200 for body within size limit", async () => {
    const app = createApp();
    const smallBody = JSON.stringify({ data: "hello" });

    const res = await app.request("/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: smallBody,
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean };
    expect(body.ok).toBe(true);
  });
});
