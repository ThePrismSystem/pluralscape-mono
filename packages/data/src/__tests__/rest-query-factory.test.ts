import { describe, expect, it, vi } from "vitest";

import { createRestQueryFactory } from "../rest-query-factory.js";

import type { ApiClient } from "@pluralscape/api-client";
import type { KdfMasterKey } from "@pluralscape/crypto";

// Build a minimal ApiClient stub typed so that GET returns a resolved FetchResponse.
// We cast to `ApiClient` via a single `as` from the same general shape to avoid
// the forbidden double-cast pattern.
function makeApiClient(data: unknown): ApiClient;
function makeApiClient(data: undefined, error: unknown): ApiClient;
function makeApiClient(data: unknown, error?: unknown): ApiClient {
  const response =
    data !== undefined ? { data, response: new Response() } : { error, response: new Response() };
  return { GET: vi.fn().mockResolvedValue(response) } as ApiClient;
}

describe("createRestQueryFactory", () => {
  it("returns a factory with a queryOptions method", () => {
    const factory = createRestQueryFactory({
      apiClient: makeApiClient(null),
      getMasterKey: () => null,
    });
    expect(typeof factory.queryOptions).toBe("function");
  });

  it("queryOptions returns an object with queryKey and queryFn", () => {
    const factory = createRestQueryFactory({
      apiClient: makeApiClient(null),
      getMasterKey: () => null,
    });
    const opts = factory.queryOptions({ queryKey: ["test"], path: "/health" as never });
    expect(opts.queryKey).toEqual(["test"]);
    expect(typeof opts.queryFn).toBe("function");
  });

  it("queryFn returns the API response data", async () => {
    const payload = { id: "abc", name: "test" };
    const factory = createRestQueryFactory({
      apiClient: makeApiClient(payload),
      getMasterKey: () => null,
    });
    const opts = factory.queryOptions({ queryKey: ["item"], path: "/health" as never });
    const result = await opts.queryFn();
    expect(result).toEqual(payload);
  });

  it("queryFn throws when API returns an error", async () => {
    const factory = createRestQueryFactory({
      apiClient: makeApiClient(undefined, { message: "Not found" }),
      getMasterKey: () => null,
    });
    const opts = factory.queryOptions({ queryKey: ["item"], path: "/health" as never });
    await expect(opts.queryFn()).rejects.toThrow("API error on");
  });

  it("queryFn applies decrypt when provided and master key is available", async () => {
    const raw = { ciphertext: "abc" };
    const decrypted = { text: "hello" };
    const masterKey = {} as KdfMasterKey;
    const factory = createRestQueryFactory({
      apiClient: makeApiClient(raw),
      getMasterKey: () => masterKey,
    });
    const decrypt = vi.fn().mockReturnValue(decrypted);
    const opts = factory.queryOptions({
      queryKey: ["item"],
      path: "/health" as never,
      decrypt,
    });
    const result = await opts.queryFn();
    expect(decrypt).toHaveBeenCalledWith(raw, masterKey);
    expect(result).toEqual(decrypted);
  });

  it("queryFn throws when decrypt is provided but master key is null", async () => {
    const factory = createRestQueryFactory({
      apiClient: makeApiClient({ ciphertext: "abc" }),
      getMasterKey: () => null,
    });
    const opts = factory.queryOptions({
      queryKey: ["item"],
      path: "/health" as never,
      decrypt: (raw) => raw,
    });
    await expect(opts.queryFn()).rejects.toThrow("Master key not available for decryption");
  });
});
