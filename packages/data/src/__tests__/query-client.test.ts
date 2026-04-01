import { describe, expect, it } from "vitest";

import { createAppQueryClient } from "../query-client.js";

describe("createAppQueryClient", () => {
  it("creates a QueryClient with configured staleTime", () => {
    const client = createAppQueryClient();
    const defaults = client.getDefaultOptions();
    expect(defaults.queries?.staleTime).toBe(30_000);
  });

  it("creates a QueryClient with configured retry", () => {
    const client = createAppQueryClient();
    const defaults = client.getDefaultOptions();
    expect(defaults.queries?.retry).toBe(2);
  });

  it("creates a QueryClient with configured gcTime", () => {
    const client = createAppQueryClient();
    const defaults = client.getDefaultOptions();
    expect(defaults.queries?.gcTime).toBe(300_000);
  });

  it("creates a QueryClient with mutation retry of 1", () => {
    const client = createAppQueryClient();
    const defaults = client.getDefaultOptions();
    expect(defaults.mutations?.retry).toBe(1);
  });
});
