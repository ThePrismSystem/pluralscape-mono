// scripts/sp-seed/__tests__/client.test.ts
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import {
  extractObjectIdFromText,
  InvalidObjectIdError,
  MalformedJwtError,
  NonJsonResponseError,
  SpApiError,
  SpClient,
  uidFromJwt,
} from "../client.js";

describe("extractObjectIdFromText", () => {
  test("returns the string when it is a valid 24-char hex", () => {
    expect(extractObjectIdFromText("507f1f77bcf86cd799439011")).toBe("507f1f77bcf86cd799439011");
  });

  test("accepts both lower- and upper-case hex", () => {
    expect(extractObjectIdFromText("507F1F77BCF86CD799439011")).toBe("507F1F77BCF86CD799439011");
  });

  test("throws InvalidObjectIdError on wrong length", () => {
    expect(() => extractObjectIdFromText("507f1f77bcf86cd79943901")).toThrow(InvalidObjectIdError);
  });

  test("throws InvalidObjectIdError on non-hex content", () => {
    expect(() => extractObjectIdFromText("not-an-object-id-xxxxxxx")).toThrow(InvalidObjectIdError);
  });

  test("throws InvalidObjectIdError on JSON-looking content", () => {
    expect(() => extractObjectIdFromText('{"id":"507f"}')).toThrow(InvalidObjectIdError);
  });

  test("throws on empty string", () => {
    expect(() => extractObjectIdFromText("")).toThrow(InvalidObjectIdError);
  });
});

describe("uidFromJwt", () => {
  // Helper to build a JWT-shaped string with a given payload JSON object.
  function makeJwt(payload: Record<string, unknown>): string {
    const header = Buffer.from('{"alg":"HS256","typ":"JWT"}').toString("base64url");
    const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
    return `${header}.${body}.fake-signature`;
  }

  test("extracts uid from `sub` claim", () => {
    const jwt = makeJwt({ sub: "abc123" });
    expect(uidFromJwt(jwt)).toBe("abc123");
  });

  test("extracts uid from `uid` claim when `sub` missing", () => {
    const jwt = makeJwt({ uid: "xyz789" });
    expect(uidFromJwt(jwt)).toBe("xyz789");
  });

  test("prefers `sub` over `uid` when both present", () => {
    const jwt = makeJwt({ sub: "from-sub", uid: "from-uid" });
    expect(uidFromJwt(jwt)).toBe("from-sub");
  });

  test("throws MalformedJwtError when payload segment is missing", () => {
    expect(() => uidFromJwt("onlyonesegment")).toThrow(MalformedJwtError);
  });

  test("throws MalformedJwtError when payload segment is empty", () => {
    expect(() => uidFromJwt("header..signature")).toThrow(MalformedJwtError);
  });

  test("throws MalformedJwtError when payload has neither sub nor uid", () => {
    const jwt = makeJwt({ other: "value" });
    expect(() => uidFromJwt(jwt)).toThrow(MalformedJwtError);
  });

  test("throws MalformedJwtError when payload is not valid base64url JSON", () => {
    expect(() => uidFromJwt("header.not-valid-json-base64.sig")).toThrow(MalformedJwtError);
  });
});

describe("SpClient.requestRaw", () => {
  let mockFetch: ReturnType<typeof vi.fn>;
  let originalFetch: typeof global.fetch;

  beforeEach(() => {
    originalFetch = global.fetch;
    mockFetch = vi.fn();
    global.fetch = mockFetch as unknown as typeof fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  test("sends Authorization header raw (no Bearer prefix)", async () => {
    mockFetch.mockResolvedValueOnce(new Response("ok", { status: 200 }));
    const client = new SpClient("https://sp.example.com", "raw-api-key-xyz");
    await client.requestRaw("/v1/me", {});
    const [, init] = mockFetch.mock.calls[0];
    const headers = init.headers as Record<string, string>;
    expect(headers["Authorization"]).toBe("raw-api-key-xyz");
    expect(headers["Authorization"]).not.toMatch(/^Bearer /);
  });

  test("throws SpApiError on 4xx with body content", async () => {
    mockFetch.mockResolvedValueOnce(new Response("bad stuff", { status: 400 }));
    const client = new SpClient("https://sp.example.com", "k");
    await expect(client.requestRaw("/v1/x", {})).rejects.toMatchObject({
      name: "SpApiError",
      status: 400,
      path: "/v1/x",
      body: "bad stuff",
    });
  });

  test("throws SpApiError on 5xx after one retry", async () => {
    mockFetch
      .mockResolvedValueOnce(new Response("fail", { status: 500 }))
      .mockResolvedValueOnce(new Response("fail again", { status: 500 }));
    const client = new SpClient("https://sp.example.com", "k");
    await expect(client.requestRaw("/v1/x", {})).rejects.toMatchObject({
      name: "SpApiError",
      status: 500,
    });
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  test("recovers from transient 5xx on second attempt", async () => {
    mockFetch
      .mockResolvedValueOnce(new Response("fail", { status: 500 }))
      .mockResolvedValueOnce(new Response("ok", { status: 200 }));
    const client = new SpClient("https://sp.example.com", "k");
    await expect(client.requestRaw("/v1/x", {})).resolves.toBe("ok");
  });
});

describe("SpClient.request", () => {
  let mockFetch: ReturnType<typeof vi.fn>;
  let originalFetch: typeof global.fetch;
  beforeEach(() => {
    originalFetch = global.fetch;
    mockFetch = vi.fn();
    global.fetch = mockFetch as unknown as typeof fetch;
  });
  afterEach(() => {
    global.fetch = originalFetch;
  });

  test("parses JSON response into typed object", async () => {
    mockFetch.mockResolvedValueOnce(new Response('{"id":"abc","name":"x"}', { status: 200 }));
    const client = new SpClient("https://sp.example.com", "k");
    const result = await client.request<{ id: string; name: string }>("/v1/me", {});
    expect(result).toEqual({ id: "abc", name: "x" });
  });

  test("throws NonJsonResponseError on unparseable body", async () => {
    mockFetch.mockResolvedValueOnce(new Response("not json at all", { status: 200 }));
    const client = new SpClient("https://sp.example.com", "k");
    await expect(client.request("/v1/me", {})).rejects.toBeInstanceOf(NonJsonResponseError);
  });
});
