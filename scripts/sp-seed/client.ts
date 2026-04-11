// scripts/sp-seed/client.ts
import { FETCH_TIMEOUT_MS, REQUEST_DELAY_MS } from "./constants.js";

export class SpApiError extends Error {
  constructor(
    readonly status: number,
    readonly method: string,
    readonly path: string,
    readonly body: string,
  ) {
    super(`SP API ${method} ${path} failed (${status}): ${body.slice(0, 200)}`);
    this.name = "SpApiError";
  }
}

export class NonJsonResponseError extends Error {
  constructor(
    readonly method: string,
    readonly path: string,
    readonly rawBody: string,
  ) {
    super(`SP API ${method} ${path} returned non-JSON body: ${rawBody.slice(0, 200)}`);
    this.name = "NonJsonResponseError";
  }
}

export class InvalidObjectIdError extends Error {
  constructor(readonly received: string) {
    super(`Expected a 24-char hex ObjectId, got: ${received.slice(0, 80)}`);
    this.name = "InvalidObjectIdError";
  }
}

export class MalformedJwtError extends Error {
  constructor(readonly reason = "malformed JWT") {
    super(reason);
    this.name = "MalformedJwtError";
  }
}

export class UnresolvedRefError extends Error {
  constructor(readonly ref: string) {
    super(`Unresolved fixture ref: "${ref}"`);
    this.name = "UnresolvedRefError";
  }
}

export class LegacyManifestError extends Error {
  constructor(readonly manifestPath: string) {
    super(`manifest format out of date — delete ${manifestPath} and re-run to regenerate`);
    this.name = "LegacyManifestError";
  }
}

/**
 * Strict ObjectId validator for raw text responses from SP entity POSTs.
 * Returns the input text unchanged on match; throws InvalidObjectIdError on mismatch.
 */
export function extractObjectIdFromText(text: string): string {
  if (!/^[0-9a-fA-F]{24}$/.test(text)) {
    throw new InvalidObjectIdError(text);
  }
  return text;
}

/**
 * Extract the user id from a JWT payload.
 * Reads the second segment as base64url-encoded JSON and returns `sub` or `uid`.
 */
export function uidFromJwt(jwt: string): string {
  const segments = jwt.split(".");
  if (segments.length < 2) {
    throw new MalformedJwtError("JWT is missing payload segment");
  }
  const payloadSegment = segments[1];
  if (!payloadSegment) {
    throw new MalformedJwtError("JWT payload segment is empty");
  }
  let json: unknown;
  try {
    const decoded = Buffer.from(payloadSegment, "base64url").toString("utf-8");
    json = JSON.parse(decoded);
  } catch {
    throw new MalformedJwtError("JWT payload is not valid base64url JSON");
  }
  if (typeof json !== "object" || json === null) {
    throw new MalformedJwtError("JWT payload is not a JSON object");
  }
  const payload = json as Record<string, unknown>;
  const sub = payload["sub"];
  if (typeof sub === "string" && sub.length > 0) return sub;
  const uid = payload["uid"];
  if (typeof uid === "string" && uid.length > 0) return uid;
  throw new MalformedJwtError("JWT payload missing sub/uid claim");
}

export type SpMode = "minimal" | "adversarial";

export interface RequestOptions {
  method?: string;
  body?: unknown;
  /** Override the Authorization header value (e.g. to use the JWT during bootstrap). */
  authOverride?: string;
}

const RETRY_BACKOFF_MS = 500;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class SpClient {
  private inflight: Promise<void> = Promise.resolve();

  constructor(
    readonly baseUrl: string,
    private readonly apiKey: string,
  ) {}

  async requestRaw(path: string, opts: RequestOptions): Promise<string> {
    // Serialize calls via a chained promise — ensures REQUEST_DELAY_MS between requests.
    const previous = this.inflight;
    let release!: () => void;
    this.inflight = new Promise<void>((r) => {
      release = r;
    });
    try {
      await previous;
      await delay(REQUEST_DELAY_MS);
      return await this.executeOnce(path, opts, /* retryOn5xx */ true);
    } finally {
      release();
    }
  }

  async request<T>(path: string, opts: RequestOptions): Promise<T> {
    const text = await this.requestRaw(path, opts);
    try {
      return JSON.parse(text) as T;
    } catch {
      throw new NonJsonResponseError(opts.method ?? "GET", path, text);
    }
  }

  private async executeOnce(
    path: string,
    opts: RequestOptions,
    retryOn5xx: boolean,
  ): Promise<string> {
    const method = opts.method ?? "GET";
    const url = `${this.baseUrl}${path}`;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Authorization: opts.authOverride ?? this.apiKey,
    };
    const init: RequestInit = {
      method,
      headers,
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    };
    if (opts.body !== undefined) {
      init.body = JSON.stringify(opts.body);
    }
    const response = await fetch(url, init);
    if (response.status >= 500 && retryOn5xx) {
      await delay(RETRY_BACKOFF_MS);
      return this.executeOnce(path, opts, /* retryOn5xx */ false);
    }
    const text = await response.text();
    if (!response.ok) {
      throw new SpApiError(response.status, method, path, text);
    }
    return text;
  }
}
