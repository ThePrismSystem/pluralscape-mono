import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  ApiSourceTokenRejectedError,
  ApiSourceTransientError,
  createApiImportSource,
} from "../../sources/api-source.js";

import type { ImportSource } from "../../sources/source.types.js";

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
    ...init,
  });
}

/** Drain the `members` iterator of an import source into an array of source IDs. */
async function drainMembers(source: ImportSource): Promise<string[]> {
  const out: string[] = [];
  for await (const doc of source.iterate("members")) {
    out.push(doc.sourceId);
  }
  return out;
}

describe("createApiImportSource", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("paginates a collection until the API returns an empty page", async () => {
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse([
          { _id: "m1", name: "A" },
          { _id: "m2", name: "B" },
        ]),
      )
      .mockResolvedValueOnce(jsonResponse([{ _id: "m3", name: "C" }]))
      .mockResolvedValueOnce(jsonResponse([]));

    const source = createApiImportSource({ token: "tk_x", baseUrl: "https://api.test" });
    const out = await drainMembers(source);
    await source.close();

    expect(out).toEqual(["m1", "m2", "m3"]);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("sends the bearer token in Authorization", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse([]));
    const source = createApiImportSource({ token: "tk_secret", baseUrl: "https://api.test" });
    await drainMembers(source);
    await source.close();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, init] = fetchMock.mock.calls[0] ?? [];
    const headers = (init as RequestInit | undefined)?.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer tk_secret");
  });

  it("throws ApiSourceTokenRejectedError on 401", async () => {
    fetchMock.mockResolvedValueOnce(new Response("nope", { status: 401 }));
    const source = createApiImportSource({ token: "tk_x", baseUrl: "https://api.test" });

    let caught: unknown;
    try {
      await drainMembers(source);
    } catch (err) {
      caught = err;
    }
    await source.close();

    expect(caught).toBeInstanceOf(ApiSourceTokenRejectedError);
  });

  it("retries on 429 with backoff and eventually succeeds", async () => {
    vi.useFakeTimers();
    fetchMock
      .mockResolvedValueOnce(new Response("rate", { status: 429 }))
      .mockResolvedValueOnce(new Response("rate", { status: 429 }))
      .mockResolvedValueOnce(jsonResponse([{ _id: "m1", name: "A" }]))
      .mockResolvedValueOnce(jsonResponse([]));

    const source = createApiImportSource({ token: "tk_x", baseUrl: "https://api.test" });
    const iterPromise = drainMembers(source);
    await vi.runAllTimersAsync();
    const out = await iterPromise;
    await source.close();

    expect(out).toEqual(["m1"]);
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it("gives up after MAX_RETRIES on persistent 429", async () => {
    vi.useFakeTimers();
    fetchMock.mockResolvedValue(new Response("rate", { status: 429 }));

    const source = createApiImportSource({ token: "tk_x", baseUrl: "https://api.test" });
    const iterPromise = (async (): Promise<unknown> => {
      try {
        await drainMembers(source);
        return null;
      } catch (err) {
        return err;
      }
    })();
    await vi.runAllTimersAsync();
    const result = await iterPromise;
    await source.close();

    expect(result).toBeInstanceOf(ApiSourceTransientError);
  });

  it("exposes mode 'api'", () => {
    const source = createApiImportSource({ token: "tk_x", baseUrl: "https://api.test" });
    expect(source.mode).toBe("api");
  });

  it("listCollections returns the static list of SP collection names the API exposes", async () => {
    const source = createApiImportSource({ token: "tk_x", baseUrl: "https://api.test" });
    const names = await source.listCollections();
    // The api source hardcodes `ENDPOINT_PATHS`, so every known SP
    // collection must be reported. Spot-check a handful of names rather
    // than re-asserting the full list (which would duplicate
    // `ENDPOINT_PATHS` in the test).
    expect(names).toContain("members");
    expect(names).toContain("groups");
    expect(names).toContain("frontHistory");
    expect(names).toContain("channels");
  });
});
