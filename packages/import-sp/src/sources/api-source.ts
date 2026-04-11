import {
  SP_API_BACKOFF_BASE_MS,
  SP_API_BACKOFF_MAX_MS,
  SP_API_MAX_RETRIES,
  SP_API_REQUEST_TIMEOUT_MS,
} from "../import-sp.constants.js";
import { toRecord } from "../shared/to-record.js";

import type { ImportDataSource, SourceEvent } from "./source.types.js";
import type { SpCollectionName } from "./sp-collections.js";

/**
 * Permanent failure fetching from the SP API: non-array response, missing
 * `_id` on a document, or a malformed document shape. Retry will not succeed.
 * Classifier maps this to `{ recoverable: false, fatal: true }`.
 */
export class ApiSourcePermanentError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "ApiSourcePermanentError";
  }
}

/** Thrown when SP rejects the bearer token (HTTP 401). Fatal-recoverable. */
export class ApiSourceTokenRejectedError extends Error {
  constructor() {
    super("Simply Plural API rejected the bearer token (HTTP 401)");
    this.name = "ApiSourceTokenRejectedError";
  }
}

/** Thrown when SP returns 5xx/429 persistently or another transient failure exhausts retries. */
export class ApiSourceTransientError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ApiSourceTransientError";
  }
}

/**
 * Per-collection fetch strategy for the live SP API.
 *
 * Path templates use `:system` as a substitution token replaced with the
 * caller-supplied `systemId`. Strategies:
 *
 *  - `list`   — single GET returning an array of documents; SP streams the
 *               whole collection in one response, so no pagination loop is
 *               required.
 *  - `single` — single GET returning one document; wrapped into a one-item
 *               array so the iterator interface is uniform.
 *  - `range`  — single GET with `?startTime=&endTime=` query over a fixed
 *               wide window. Used for `frontHistory`, which SP exposes only
 *               as a time-bounded query.
 *  - `unsupported` — SP exposes no bulk endpoint for the collection (e.g.
 *               per-document comments, per-member notes, per-channel chat
 *               messages). The iterator yields nothing rather than throwing
 *               so the engine can still import the collections that do
 *               work; operators importing these collections must use the
 *               file source.
 */
type ApiFetchStrategy =
  | { readonly kind: "list"; readonly path: string }
  | { readonly kind: "single"; readonly path: string }
  | { readonly kind: "range"; readonly path: string }
  | { readonly kind: "unsupported"; readonly reason: string };

/**
 * Mapping from internal SP collection name to its live SP API fetch
 * strategy. Verified against `src/api/v1/routes.ts` in the upstream SP repo
 * (`ApparyllisOrg/SimplyPluralApi`). Notable mismatches fixed from the
 * previous best-guess table:
 *
 *  - `members`, `groups`, `customFields`, `customFronts`, `polls`,
 *    `frontHistory` all require `:system` in the path.
 *  - `channels` / `channelCategories` / `chatMessages` are mounted under
 *    `/v1/chat/`, not `/v1/channels`.
 *  - `frontStatuses` is called `customFronts` in the API URL.
 *  - `users` / `private` are singleton GETs on `/v1/user/:id` and
 *    `/v1/user/private/:id`, not bulk lists.
 *  - `privacyBuckets` does not take `:system` (derived from auth context).
 *  - `comments`, `notes`, `chatMessages`, `boardMessages` have no bulk
 *    list endpoints — each requires per-parent traversal (per-document,
 *    per-member, per-channel, per-member respectively) and are marked
 *    unsupported pending a multi-pass fetcher.
 */
const ENDPOINT_STRATEGIES: Readonly<Record<SpCollectionName, ApiFetchStrategy>> = {
  users: { kind: "single", path: "/v1/user/:system" },
  private: { kind: "single", path: "/v1/user/private/:system" },
  privacyBuckets: { kind: "list", path: "/v1/privacyBuckets" },
  customFields: { kind: "list", path: "/v1/customFields/:system" },
  frontStatuses: { kind: "list", path: "/v1/customFronts/:system" },
  members: { kind: "list", path: "/v1/members/:system" },
  groups: { kind: "list", path: "/v1/groups/:system" },
  frontHistory: { kind: "range", path: "/v1/frontHistory/:system" },
  comments: {
    kind: "unsupported",
    reason: "SP exposes comments per-document only (/v1/comments/:type/:id)",
  },
  notes: {
    kind: "unsupported",
    reason: "SP exposes notes per-member only (/v1/notes/:system/:member)",
  },
  polls: { kind: "list", path: "/v1/polls/:system" },
  channelCategories: { kind: "list", path: "/v1/chat/categories" },
  channels: { kind: "list", path: "/v1/chat/channels" },
  chatMessages: {
    kind: "unsupported",
    reason: "SP exposes chat messages per-channel only (/v1/chat/messages/:id)",
  },
  boardMessages: {
    kind: "unsupported",
    reason: "SP exposes board messages per-member only (/v1/board/member/:id)",
  },
};

/** HTTP 401 Unauthorized — the bearer token is missing or invalid. */
const HTTP_UNAUTHORIZED = 401;
/** HTTP 429 Too Many Requests — SP is rate-limiting us. */
const HTTP_RATE_LIMITED = 429;
/** Lower bound of the server-error range (inclusive). */
const HTTP_SERVER_ERROR_MIN = 500;
/** Upper bound of the server-error range (inclusive). */
const HTTP_SERVER_ERROR_MAX = 599;

/** Backoff grows as `BASE * 2^attempt` capped at `MAX`. */
const BACKOFF_EXPONENT_BASE = 2;

/**
 * Wide-open lower bound for the `frontHistory` range fetch. Unix epoch zero
 * predates any real SP account, so `startTime=0` pulls the full history.
 */
const FRONT_HISTORY_RANGE_START_MS = 0;

export interface ApiSourceInput {
  readonly token: string;
  readonly baseUrl: string;
  /**
   * SP system id (same as the authenticated user's uid) used to substitute
   * `:system` in path templates. Required — most SP list endpoints are
   * scoped by system and return 404 without it.
   */
  readonly systemId: string;
}

function delayMs(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function backoffFor(attempt: number): number {
  return Math.min(SP_API_BACKOFF_BASE_MS * BACKOFF_EXPONENT_BASE ** attempt, SP_API_BACKOFF_MAX_MS);
}

/** Substitute `:system` in a path template with the caller-supplied system id. */
function substituteSystem(path: string, systemId: string): string {
  return path.replace(":system", encodeURIComponent(systemId));
}

/**
 * List of SP collection names the api source can fetch via a single HTTP
 * request. Collections whose strategy is `unsupported` are omitted so the
 * engine does not count them as source-provided during its
 * dropped-collection check.
 */
const LISTABLE_COLLECTIONS: readonly SpCollectionName[] = (
  Object.entries(ENDPOINT_STRATEGIES) as readonly [SpCollectionName, ApiFetchStrategy][]
)
  .filter(([, strategy]) => strategy.kind !== "unsupported")
  .map(([name]) => name);

/**
 * Create an `ImportDataSource` that streams a Simply Plural account from
 * its REST API. The constructor is synchronous; network I/O happens lazily
 * during `iterate()`.
 *
 * Error policy:
 * - 401 Unauthorized → `ApiSourceTokenRejectedError` (the engine pauses for
 *   token re-entry and retries once the user supplies a fresh token).
 * - 429 Rate Limited and 5xx → retry up to `SP_API_MAX_RETRIES` with
 *   exponential backoff; throws `ApiSourceTransientError` if exhausted.
 * - Network errors (`fetch` rejects) → also retried, then surfaced as
 *   `ApiSourceTransientError`.
 * - Any other non-2xx → `ApiSourceTransientError` without retrying (4xx other
 *   than 401 is unlikely to resolve on a retry).
 * - Shape failures on list/range responses (non-array body) →
 *   `ApiSourcePermanentError`. Per-document shape failures (non-object
 *   element, missing `_id`) are emitted as `drop` events so the engine
 *   can keep iterating the rest of the collection.
 *
 * SP streams full collections in a single response, so no pagination loop
 * is required. Collections without a bulk list endpoint yield nothing —
 * use the file source for a complete import.
 */
export function createApiImportSource(input: ApiSourceInput): ImportDataSource {
  async function fetchJson(url: string): Promise<unknown> {
    let attempt = 0;
    while (attempt <= SP_API_MAX_RETRIES) {
      const controller = new AbortController();
      const timeout = setTimeout(() => {
        controller.abort();
      }, SP_API_REQUEST_TIMEOUT_MS);

      let response: Response;
      try {
        response = await fetch(url, {
          headers: {
            Authorization: `Bearer ${input.token}`,
            Accept: "application/json",
          },
          signal: controller.signal,
        });
      } catch (err) {
        clearTimeout(timeout);
        if (attempt >= SP_API_MAX_RETRIES) {
          const message = err instanceof Error ? err.message : String(err);
          throw new ApiSourceTransientError(
            `Network error after ${String(attempt + 1)} attempts: ${message}`,
          );
        }
        await delayMs(backoffFor(attempt));
        attempt++;
        continue;
      }
      clearTimeout(timeout);

      if (response.status === HTTP_UNAUTHORIZED) {
        throw new ApiSourceTokenRejectedError();
      }

      const isRateLimited = response.status === HTTP_RATE_LIMITED;
      const isServerError =
        response.status >= HTTP_SERVER_ERROR_MIN && response.status <= HTTP_SERVER_ERROR_MAX;
      if (isRateLimited || isServerError) {
        if (attempt >= SP_API_MAX_RETRIES) {
          throw new ApiSourceTransientError(
            `SP API returned ${String(response.status)} after ${String(attempt + 1)} attempts`,
          );
        }
        await delayMs(backoffFor(attempt));
        attempt++;
        continue;
      }

      if (!response.ok) {
        throw new ApiSourceTransientError(
          `SP API returned ${String(response.status)} (${response.statusText})`,
        );
      }

      return (await response.json()) as unknown;
    }
    // Unreachable — the loop exits via `return` or a thrown error — but
    // keep an explicit throw so TypeScript's control-flow analysis is happy.
    throw new ApiSourceTransientError("retry loop exhausted");
  }

  function buildUrl(strategy: ApiFetchStrategy & { kind: "list" | "single" | "range" }): string {
    const path = substituteSystem(strategy.path, input.systemId);
    const base = `${input.baseUrl}${path}`;
    if (strategy.kind === "range") {
      const now = Date.now();
      return `${base}?startTime=${String(FRONT_HISTORY_RANGE_START_MS)}&endTime=${String(now)}`;
    }
    return base;
  }

  type AssertResult =
    | { readonly kind: "ok"; readonly sourceId: string; readonly record: Record<string, unknown> }
    | { readonly kind: "drop"; readonly sourceId: string | null; readonly reason: string };

  function assertDocument(
    value: unknown,
    collection: SpCollectionName,
    index: number,
  ): AssertResult {
    if (value === null || typeof value !== "object") {
      return {
        kind: "drop",
        sourceId: null,
        reason: `ApiImportSource: ${collection}[${String(index)}] is a non-object document (got ${typeof value})`,
      };
    }
    const record = toRecord(value);
    const id = record._id;
    if (typeof id !== "string" || id.length === 0) {
      return {
        kind: "drop",
        sourceId: null,
        reason: `ApiImportSource: ${collection}[${String(index)}] missing required "_id" field`,
      };
    }
    return { kind: "ok", sourceId: id, record };
  }

  return {
    mode: "api",
    async *iterate(collection: SpCollectionName): AsyncGenerator<SourceEvent> {
      const strategy = ENDPOINT_STRATEGIES[collection];
      if (strategy.kind === "unsupported") {
        // The SP API does not expose a simple bulk endpoint for this
        // collection. Yield nothing so the engine keeps processing the
        // rest of DEPENDENCY_ORDER — operators who need these collections
        // should import from a file export instead.
        return;
      }

      const url = buildUrl(strategy);
      const body = await fetchJson(url);

      if (strategy.kind === "single") {
        if (body === null) return;
        if (Array.isArray(body)) {
          yield {
            kind: "drop",
            collection,
            sourceId: null,
            reason: `SP API ${collection} endpoint returned an array (expected single document)`,
          };
          return;
        }
        // `{}` means the target document does not exist (e.g. a `private` doc
        // for an account that never touched notification settings) — legitimate
        // skip, not a drop.
        if (typeof body === "object" && Object.keys(body).length === 0) return;
        const result = assertDocument(body, collection, 0);
        if (result.kind === "drop") {
          yield { kind: "drop", collection, sourceId: result.sourceId, reason: result.reason };
          return;
        }
        yield { kind: "doc", collection, sourceId: result.sourceId, document: result.record };
        return;
      }

      // list or range strategies — both return an array.
      if (!Array.isArray(body)) {
        throw new ApiSourcePermanentError(
          `SP API returned non-array body for ${url} (got ${typeof body})`,
        );
      }
      let index = 0;
      for (const element of body) {
        const result = assertDocument(element, collection, index);
        if (result.kind === "drop") {
          yield { kind: "drop", collection, sourceId: result.sourceId, reason: result.reason };
        } else {
          yield { kind: "doc", collection, sourceId: result.sourceId, document: result.record };
        }
        index += 1;
      }
    },
    listCollections() {
      // Only collections with a usable bulk/single endpoint are reported.
      // This deliberately returns a narrower set than the full
      // `SpCollectionName` union — see the strategy map above.
      return Promise.resolve(LISTABLE_COLLECTIONS as readonly string[] as string[]);
    },
    async close(): Promise<void> {
      // No held resources — fetch is request-scoped.
    },
  };
}
