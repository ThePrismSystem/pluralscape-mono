import { describe, expect, it } from "vitest";

import { createApiClient } from "../index.js";

describe("createApiClient", () => {
  it("creates a client with baseUrl and auth", () => {
    const client = createApiClient({
      baseUrl: "http://localhost:3000",
      getToken: () => "ps_sess_test123",
      platform: "mobile",
    });
    expect(client).toBeDefined();
    expect(client.GET).toBeTypeOf("function");
    expect(client.POST).toBeTypeOf("function");
  });

  it("attaches Authorization header when token is available", async () => {
    let capturedHeaders: Headers | undefined;

    const client = createApiClient({
      baseUrl: "http://localhost:3000",
      getToken: () => "ps_sess_token42",
    });

    client.use({
      onRequest({ request }) {
        capturedHeaders = request.headers;
        throw new Error("intercepted");
      },
    });

    await expect(client.GET("/api/v1/health" as never)).rejects.toThrow("intercepted");

    expect(capturedHeaders?.get("Authorization")).toBe("Bearer ps_sess_token42");
  });

  it("does not attach Authorization header when token is null", async () => {
    let capturedHeaders: Headers | undefined;

    const client = createApiClient({
      baseUrl: "http://localhost:3000",
      getToken: () => null,
    });

    client.use({
      onRequest({ request }) {
        capturedHeaders = request.headers;
        throw new Error("intercepted");
      },
    });

    await expect(client.GET("/api/v1/health" as never)).rejects.toThrow("intercepted");

    expect(capturedHeaders?.get("Authorization")).toBeNull();
  });
});
