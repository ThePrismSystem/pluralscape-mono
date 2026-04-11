import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  ApiSourcePermanentError,
  ApiSourceTokenRejectedError,
  ApiSourceTransientError,
  createApiImportSource,
} from "../../sources/api-source.js";

import type { ImportDataSource } from "../../sources/source.types.js";
import type { SpCollectionName } from "../../sources/sp-collections.js";

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
    ...init,
  });
}

/** Drain an iterator of an import source into an array of source IDs. */
async function drain(source: ImportDataSource, collection: SpCollectionName): Promise<string[]> {
  const out: string[] = [];
  for await (const doc of source.iterate(collection)) {
    out.push(doc.sourceId);
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
    const out = await drain(source, "private");
    await source.close();

    expect(out).toEqual([]);
  });

  it("appends a wide startTime/endTime query for frontHistory", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse([]));
    const source = createApiImportSource(DEFAULT_INPUT);
    await drain(source, "frontHistory");
    await source.close();

    const [url] = fetchMock.mock.calls[0] ?? [];
    const urlString = url as string;
    expect(urlString).toMatch(
      /^https:\/\/api\.test\/v1\/frontHistory\/sys_abc\?startTime=0&endTime=\d+$/,
    );
  });

  it("yields nothing for unsupported collections rather than throwing", async () => {
    const source = createApiImportSource(DEFAULT_INPUT);
    const comments = await drain(source, "comments");
    const notes = await drain(source, "notes");
    const chatMessages = await drain(source, "chatMessages");
    const boardMessages = await drain(source, "boardMessages");
    await source.close();

    expect(comments).toEqual([]);
    expect(notes).toEqual([]);
    expect(chatMessages).toEqual([]);
    expect(boardMessages).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sends the bearer token in Authorization", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse([]));
    const source = createApiImportSource({ ...DEFAULT_INPUT, token: "tk_secret" });
    await drain(source, "members");
    await source.close();

    const [, init] = fetchMock.mock.calls[0] ?? [];
    const headers = (init as RequestInit | undefined)?.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer tk_secret");
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
    expect(names).toContain("private");
    expect(names).toContain("privacyBuckets");

    // Unsupported collections must NOT be reported — the engine would
    // otherwise include them in its known-dropped checks.
    expect(names).not.toContain("comments");
    expect(names).not.toContain("notes");
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

  it("throws ApiSourcePermanentError when a document is missing _id", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse([{ name: "no id here" }]));
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
});
