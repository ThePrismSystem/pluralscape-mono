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
});
