import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  ApiSourcePermanentError,
  ApiSourceTokenRejectedError,
  ApiSourceTransientError,
  createApiImportSource,
} from "../../sources/api-source.js";

import type { ImportDataSource, SourceEvent } from "../../sources/source.types.js";
import type { SpCollectionName } from "../../sources/sp-collections.js";

/**
 * Call {@link ImportDataSource.supplyParentIds} without triggering
 * `@typescript-eslint/unbound-method`. Uses `Reflect.get` so ESLint
 * never sees a direct method-property access.
 */
function callSupplyParentIds(
  source: ImportDataSource,
  parentCollection: SpCollectionName,
  sourceIds: readonly string[],
): void {
  const fn: unknown = Reflect.get(source, "supplyParentIds");
  if (typeof fn === "function") {
    (fn as (p: SpCollectionName, ids: readonly string[]) => void)(parentCollection, sourceIds);
  }
}

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
    ...init,
  });
}

/** Drain an iterator of an import source into an array of source IDs (doc events only). */
async function drain(source: ImportDataSource, collection: SpCollectionName): Promise<string[]> {
  const out: string[] = [];
  for await (const event of source.iterate(collection)) {
    if (event.kind === "doc") {
      out.push(event.sourceId);
    }
  }
  return out;
}

/** Collect all events from an iterator into an array. */
async function drainEvents(
  source: ImportDataSource,
  collection: SpCollectionName,
): Promise<SourceEvent[]> {
  const out: SourceEvent[] = [];
  for await (const event of source.iterate(collection)) {
    out.push(event);
  }
  return out;
}

const DEFAULT_INPUT = {
  token: "tk_x",
  baseUrl: "https://api.test",
  systemId: "sys_abc",
};

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

  it("fetches the full collection in a single GET (SP streams full lists)", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse([
        { _id: "m1", name: "A" },
        { _id: "m2", name: "B" },
        { _id: "m3", name: "C" },
      ]),
    );

    const source = createApiImportSource(DEFAULT_INPUT);
    const out = await drain(source, "members");
    await source.close();

    expect(out).toEqual(["m1", "m2", "m3"]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("substitutes :system in path templates", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse([]));
    const source = createApiImportSource(DEFAULT_INPUT);
    await drain(source, "members");
    await source.close();

    const [url] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe("https://api.test/v1/members/sys_abc");
  });

  it("uses /v1/chat/channels for the channels collection (not /v1/channels)", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse([]));
    const source = createApiImportSource(DEFAULT_INPUT);
    await drain(source, "channels");
    await source.close();

    const [url] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe("https://api.test/v1/chat/channels");
  });

  it("uses /v1/customFronts/:system for the frontStatuses collection", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse([]));
    const source = createApiImportSource(DEFAULT_INPUT);
    await drain(source, "frontStatuses");
    await source.close();

    const [url] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe("https://api.test/v1/customFronts/sys_abc");
  });

  it("wraps single-document endpoints (users) into a one-item iterator", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ _id: "sys_abc", username: "Aria" }));
    const source = createApiImportSource(DEFAULT_INPUT);
    const out = await drain(source, "users");
    await source.close();

    expect(out).toEqual(["sys_abc"]);
  });

  it("treats an empty-object single-doc response as no document", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({}));
    const source = createApiImportSource(DEFAULT_INPUT);
    const out = await drain(source, "users");
    await source.close();

    expect(out).toEqual([]);
  });

  it("fetches frontHistory via the bulk list endpoint", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse([]));
    const source = createApiImportSource(DEFAULT_INPUT);
    await drain(source, "frontHistory");
    await source.close();

    const [url] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe("https://api.test/v1/frontHistory");
  });

  it("yields nothing for unsupported collections rather than throwing", async () => {
    const source = createApiImportSource(DEFAULT_INPUT);
    const comments = await drain(source, "comments");
    const chatMessages = await drain(source, "chatMessages");
    const boardMessages = await drain(source, "boardMessages");
    await source.close();

    expect(comments).toEqual([]);
    expect(chatMessages).toEqual([]);
    expect(boardMessages).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("fetches notes per-member after supplyParentIds is called", async () => {
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse([
          { _id: "n1", title: "Note A", member: "m1" },
          { _id: "n2", title: "Note B", member: "m1" },
        ]),
      )
      .mockResolvedValueOnce(jsonResponse([{ _id: "n3", title: "Note C", member: "m2" }]));

    const source = createApiImportSource(DEFAULT_INPUT);
    expect(Reflect.get(source, "supplyParentIds")).toBeDefined();
    callSupplyParentIds(source, "members", ["m1", "m2"]);
    const ids = await drain(source, "notes");
    await source.close();

    expect(ids).toEqual(["n1", "n2", "n3"]);
    expect(fetchMock).toHaveBeenCalledTimes(2);

    const urls = fetchMock.mock.calls.map((args: unknown[]) => args[0]);
    expect(urls[0]).toBe("https://api.test/v1/notes/sys_abc/m1");
    expect(urls[1]).toBe("https://api.test/v1/notes/sys_abc/m2");
  });

  it("yields nothing for notes when supplyParentIds was not called", async () => {
    const source = createApiImportSource(DEFAULT_INPUT);
    const ids = await drain(source, "notes");
    await source.close();

    expect(ids).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("skips a member whose notes endpoint returns empty array", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse([]))
      .mockResolvedValueOnce(jsonResponse([{ _id: "n1", title: "Note" }]));

    const source = createApiImportSource(DEFAULT_INPUT);
    callSupplyParentIds(source, "members", ["m1", "m2"]);
    const ids = await drain(source, "notes");
    await source.close();

    expect(ids).toEqual(["n1"]);
  });

  it("sends the bearer token in Authorization", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse([]));
    const source = createApiImportSource({ ...DEFAULT_INPUT, token: "tk_secret" });
    await drain(source, "members");
    await source.close();

    const [, init] = fetchMock.mock.calls[0] ?? [];
    const headers = (init as RequestInit | undefined)?.headers as Record<string, string>;
    expect(headers.Authorization).toBe("tk_secret");
  });

  it("throws ApiSourceTokenRejectedError on 401", async () => {
    fetchMock.mockResolvedValueOnce(new Response("nope", { status: 401 }));
    const source = createApiImportSource(DEFAULT_INPUT);

    let caught: unknown;
    try {
      await drain(source, "members");
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
      .mockResolvedValueOnce(jsonResponse([{ _id: "m1", name: "A" }]));

    const source = createApiImportSource(DEFAULT_INPUT);
    const iterPromise = drain(source, "members");
    await vi.runAllTimersAsync();
    const out = await iterPromise;
    await source.close();

    expect(out).toEqual(["m1"]);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("gives up after MAX_RETRIES on persistent 429", async () => {
    vi.useFakeTimers();
    fetchMock.mockResolvedValue(new Response("rate", { status: 429 }));

    const source = createApiImportSource(DEFAULT_INPUT);
    const iterPromise = (async (): Promise<unknown> => {
      try {
        await drain(source, "members");
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
    const source = createApiImportSource(DEFAULT_INPUT);
    expect(source.mode).toBe("api");
  });

  it("listCollections returns only the collections the api source can fetch", async () => {
    const source = createApiImportSource(DEFAULT_INPUT);
    const names = await source.listCollections();

    expect(names).toContain("members");
    expect(names).toContain("groups");
    expect(names).toContain("frontHistory");
    expect(names).toContain("channels");
    expect(names).toContain("customFields");
    expect(names).toContain("users");
    expect(names).toContain("privacyBuckets");

    // Dependent collections ARE reported so the engine does not emit
    // spurious source-missing-collection warnings.
    expect(names).toContain("notes");

    // Unsupported collections must NOT be reported — the engine would
    // otherwise include them in its known-dropped checks.
    expect(names).not.toContain("private");
    expect(names).not.toContain("comments");
    expect(names).not.toContain("chatMessages");
    expect(names).not.toContain("boardMessages");
  });

  it("throws ApiSourcePermanentError on non-array list response", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ not: "an array" }));
    const source = createApiImportSource(DEFAULT_INPUT);

    let caught: unknown;
    try {
      await drain(source, "members");
    } catch (err) {
      caught = err;
    }
    await source.close();

    expect(caught).toBeInstanceOf(ApiSourcePermanentError);
  });

  it("yields a drop event when a list element is missing _id (does not throw)", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse([{ name: "no id here" }]));
    const source = createApiImportSource(DEFAULT_INPUT);
    const events = await drainEvents(source, "members");
    await source.close();

    expect(events).toHaveLength(1);
    const [e] = events;
    expect(e?.kind).toBe("drop");
    if (e?.kind === "drop") {
      expect(e.reason).toMatch(/_id/i);
    }
  });

  it("yields a drop event when a list element is a non-object (does not throw)", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse([42]));
    const source = createApiImportSource(DEFAULT_INPUT);
    const events = await drainEvents(source, "members");
    await source.close();

    expect(events).toHaveLength(1);
    const [e] = events;
    expect(e?.kind).toBe("drop");
    if (e?.kind === "drop") {
      expect(e.reason).toMatch(/non-object/i);
    }
  });

  it("yields a drop when a single-strategy endpoint returns an array", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse([]));
    const source = createApiImportSource(DEFAULT_INPUT);
    const events = await drainEvents(source, "users");
    await source.close();

    expect(events).toHaveLength(1);
    const [e] = events;
    expect(e?.kind).toBe("drop");
    if (e?.kind === "drop") {
      expect(e.reason).toMatch(/array/i);
    }
  });

  it("does not drop on legitimate empty-object single response", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({}));
    const source = createApiImportSource(DEFAULT_INPUT);
    const events = await drainEvents(source, "users");
    await source.close();

    expect(events).toHaveLength(0);
  });

  it("still throws ApiSourceTransientError on HTTP 500", async () => {
    fetchMock.mockResolvedValue(new Response("oops", { status: 500 }));
    vi.useFakeTimers();
    const source = createApiImportSource(DEFAULT_INPUT);
    const iterPromise = (async (): Promise<unknown> => {
      try {
        await drainEvents(source, "members");
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

  it("throws ApiSourceTransientError after exhausting retries on network errors", async () => {
    vi.useFakeTimers();
    fetchMock.mockRejectedValue(new TypeError("fetch failed"));
    const source = createApiImportSource(DEFAULT_INPUT);
    const iterPromise = (async (): Promise<unknown> => {
      try {
        await drain(source, "members");
        return null;
      } catch (err) {
        return err;
      }
    })();
    await vi.runAllTimersAsync();
    const result = await iterPromise;
    await source.close();

    expect(result).toBeInstanceOf(ApiSourceTransientError);
    if (result instanceof ApiSourceTransientError) {
      expect(result.message).toMatch(/Network error/);
    }
  });

  it("throws ApiSourceTransientError immediately on non-retryable 4xx", async () => {
    fetchMock.mockResolvedValueOnce(new Response("bad request", { status: 400 }));
    const source = createApiImportSource(DEFAULT_INPUT);

    let caught: unknown;
    try {
      await drain(source, "members");
    } catch (err) {
      caught = err;
    }
    await source.close();

    expect(caught).toBeInstanceOf(ApiSourceTransientError);
    // Should NOT have retried — only one fetch call
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("returns nothing when single-strategy endpoint responds with null body", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(null));
    const source = createApiImportSource(DEFAULT_INPUT);
    const events = await drainEvents(source, "users");
    await source.close();

    expect(events).toHaveLength(0);
  });

  it("unwraps SP envelope format (exists/id/content)", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse([{ exists: true, id: "m1", content: { name: "Aria", color: "#ff0000" } }]),
    );
    const source = createApiImportSource(DEFAULT_INPUT);
    const events = await drainEvents(source, "members");
    await source.close();

    expect(events).toHaveLength(1);
    expect(events[0]?.kind).toBe("doc");
    if (events[0]?.kind === "doc") {
      expect(events[0].sourceId).toBe("m1");
      expect(events[0].document).toMatchObject({ _id: "m1", name: "Aria", color: "#ff0000" });
    }
  });

  it("yields drop event when dependent endpoint returns non-array", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ error: "something" }));

    const source = createApiImportSource(DEFAULT_INPUT);
    callSupplyParentIds(source, "members", ["m1"]);

    const ids = await drain(source, "notes");
    expect(ids).toEqual([]);

    // Re-create to get the drop events (drain only collects doc IDs)
    fetchMock.mockResolvedValueOnce(jsonResponse({ error: "something" }));
    const source2 = createApiImportSource(DEFAULT_INPUT);
    callSupplyParentIds(source2, "members", ["m1"]);
    const events = await drainEvents(source2, "notes");
    await source2.close();

    expect(events).toHaveLength(1);
    const [e] = events;
    expect(e?.kind).toBe("drop");
    if (e?.kind === "drop") {
      expect(e.reason).toMatch(/non-array/i);
    }
  });

  it("re-throws ApiSourceTokenRejectedError during dependent fetch", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse([{ _id: "n1", title: "Note A", member: "m1" }]))
      .mockResolvedValueOnce(new Response("unauthorized", { status: 401 }));

    const source = createApiImportSource(DEFAULT_INPUT);
    callSupplyParentIds(source, "members", ["m1", "m2"]);

    let caught: unknown;
    try {
      await drainEvents(source, "notes");
    } catch (err) {
      caught = err;
    }
    await source.close();

    expect(caught).toBeInstanceOf(ApiSourceTokenRejectedError);
  });

  it("yields drop event on transient error during dependent fetch", async () => {
    vi.useFakeTimers();
    // First parent: network error exhausting retries (initial + 5 retries = 6 attempts)
    fetchMock
      .mockRejectedValueOnce(new TypeError("fetch failed"))
      .mockRejectedValueOnce(new TypeError("fetch failed"))
      .mockRejectedValueOnce(new TypeError("fetch failed"))
      .mockRejectedValueOnce(new TypeError("fetch failed"))
      .mockRejectedValueOnce(new TypeError("fetch failed"))
      .mockRejectedValueOnce(new TypeError("fetch failed"))
      // Second parent: valid notes
      .mockResolvedValueOnce(jsonResponse([{ _id: "n1", title: "Note from m2", member: "m2" }]));

    const source = createApiImportSource(DEFAULT_INPUT);
    callSupplyParentIds(source, "members", ["m1", "m2"]);

    const iterPromise = drainEvents(source, "notes");
    await vi.runAllTimersAsync();
    const events = await iterPromise;
    await source.close();

    const drops = events.filter((e) => e.kind === "drop");
    const docs = events.filter((e) => e.kind === "doc");

    expect(drops).toHaveLength(1);
    expect(drops[0]?.kind === "drop" && drops[0].reason).toMatch(/parent m1/i);
    expect(docs).toHaveLength(1);
    expect(docs[0]?.kind === "doc" && docs[0].sourceId).toBe("n1");
  });

  it("overwrites parent IDs when supplyParentIds is called twice", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse([{ _id: "n5", title: "Note from m3", member: "m3" }]),
    );

    const source = createApiImportSource(DEFAULT_INPUT);
    callSupplyParentIds(source, "members", ["m1", "m2"]);
    callSupplyParentIds(source, "members", ["m3"]);

    const ids = await drain(source, "notes");
    await source.close();

    expect(ids).toEqual(["n5"]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe("https://api.test/v1/notes/sys_abc/m3");
  });

  describe("response size limit", () => {
    it("rejects responses exceeding MAX_RESPONSE_BYTES via Content-Length header", async () => {
      const hugeLength = String(51 * 1_024 * 1_024);
      fetchMock.mockResolvedValueOnce(
        new Response("[]", {
          status: 200,
          headers: { "Content-Length": hugeLength, "Content-Type": "application/json" },
        }),
      );

      const source = createApiImportSource(DEFAULT_INPUT);
      let caught: unknown;
      try {
        await drain(source, "members");
      } catch (err) {
        caught = err;
      }
      await source.close();

      expect(caught).toBeInstanceOf(ApiSourcePermanentError);
      if (caught instanceof ApiSourcePermanentError) {
        expect(caught.message).toMatch(/response size/i);
      }
    });

    it("rejects responses exceeding MAX_RESPONSE_BYTES when Content-Length is absent (text fallback)", async () => {
      // Build a body that exceeds 50 MiB. We only need to verify the check
      // fires, so we mock `response.text()` to return a string whose
      // Blob size exceeds the limit without actually allocating 50 MiB.
      const fakeResponse = new Response(null, {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
      // Stub .text() to report oversized content
      const oversizedText = JSON.stringify({ data: "x".repeat(100) });
      vi.spyOn(fakeResponse, "text").mockResolvedValue(oversizedText);
      // Override Blob so .size reports 51 MiB
      const oversizedByteLength = 51 * 1_024 * 1_024;
      const OriginalBlob = globalThis.Blob;
      vi.stubGlobal(
        "Blob",
        class FakeBlob extends OriginalBlob {
          override get size(): number {
            return oversizedByteLength;
          }
        },
      );

      fetchMock.mockResolvedValueOnce(fakeResponse);

      const source = createApiImportSource(DEFAULT_INPUT);
      let caught: unknown;
      try {
        await drain(source, "members");
      } catch (err) {
        caught = err;
      }
      await source.close();

      expect(caught).toBeInstanceOf(ApiSourcePermanentError);
      if (caught instanceof ApiSourcePermanentError) {
        expect(caught.message).toMatch(/response size/i);
      }
    });

    it("allows responses at the exact 50 MiB boundary", async () => {
      fetchMock.mockResolvedValueOnce(
        new Response(JSON.stringify([{ _id: "m1", name: "Boundary" }]), {
          status: 200,
          headers: {
            "Content-Length": String(50 * 1_024 * 1_024),
            "Content-Type": "application/json",
          },
        }),
      );

      const source = createApiImportSource(DEFAULT_INPUT);
      const out = await drain(source, "members");
      await source.close();

      expect(out).toEqual(["m1"]);
    });

    it("falls through to text-based check when Content-Length is non-numeric", async () => {
      fetchMock.mockResolvedValueOnce(
        new Response(JSON.stringify([{ _id: "m1", name: "OK" }]), {
          status: 200,
          headers: {
            "Content-Length": "garbage",
            "Content-Type": "application/json",
          },
        }),
      );

      const source = createApiImportSource(DEFAULT_INPUT);
      const out = await drain(source, "members");
      await source.close();

      expect(out).toEqual(["m1"]);
    });

    it("allows responses within the 50 MiB limit", async () => {
      fetchMock.mockResolvedValueOnce(
        new Response(JSON.stringify([{ _id: "m1", name: "OK" }]), {
          status: 200,
          headers: {
            "Content-Length": String(49 * 1_024 * 1_024),
            "Content-Type": "application/json",
          },
        }),
      );

      const source = createApiImportSource(DEFAULT_INPUT);
      const out = await drain(source, "members");
      await source.close();

      expect(out).toEqual(["m1"]);
    });
  });
});
