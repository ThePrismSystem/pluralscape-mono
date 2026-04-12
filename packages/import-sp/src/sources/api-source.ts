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
 *  - `unsupported` — SP exposes no bulk endpoint for the collection (e.g.
 *               per-document comments, per-channel chat messages). The
 *               iterator yields nothing rather than throwing so the engine
 *               can still import the collections that do work; operators
 *               importing these collections must use the file source.
 *  - `dependent` — fetches per-parent: after the engine completes a parent
 *               collection it calls `supplyParentIds` with the collected
 *               IDs, and the iterator fans out one request per parent.
 */
type ApiFetchStrategy =
  | { readonly kind: "list"; readonly path: string }
  | { readonly kind: "single"; readonly path: string }
  | { readonly kind: "unsupported"; readonly reason: string }
  | {
      readonly kind: "dependent";
      readonly parentCollection: SpCollectionName;
      /** Path template with `:system` and `:parent` substitution tokens. */
      readonly path: string;
    };

/**
 * Mapping from internal SP collection name to its live SP API fetch
 * strategy. Verified against `src/api/v1/routes.ts` in the upstream SP
 * repo (`ApparyllisOrg/SimplyPluralApi`). Routing quirks in the upstream
 * SP API that are easy to get wrong:
 *
 *  - `members`, `groups`, `customFields`, `customFronts`, `polls`
 *    all require `:system` in the path.
 *  - `frontHistory` is a flat list at `/v1/frontHistory` (no `:system`);
 *    the API scopes by auth context.
 *  - `channels` / `channelCategories` / `chatMessages` are mounted under
 *    `/v1/chat/`, not `/v1/channels`.
 *  - `frontStatuses` is called `customFronts` in the API URL.
 *  - `users` / `private` are singleton GETs on `/v1/user/:id` and
 *    `/v1/user/private/:id`, not bulk lists.
 *  - `privacyBuckets` does not take `:system` (derived from auth context).
 *  - `comments`, `chatMessages`, `boardMessages` have no bulk list
 *    endpoints — each requires per-parent traversal (per-document,
 *    per-channel, per-member respectively) and are marked unsupported
 *    pending a multi-pass fetcher.
 *  - `notes` uses a `dependent` strategy that fetches per-member after
 *    the engine supplies member IDs via `supplyParentIds`.
 */
const ENDPOINT_STRATEGIES: Readonly<Record<SpCollectionName, ApiFetchStrategy>> = {
  users: { kind: "single", path: "/v1/user/:system" },
  private: {
    kind: "unsupported",
    reason:
      "SP exposes /v1/user/private/:id with JWT-only auth (isUserAppJwtAuthenticated) — API keys are rejected with 401",
  },
  privacyBuckets: { kind: "list", path: "/v1/privacyBuckets" },
  customFields: { kind: "list", path: "/v1/customFields/:system" },
  frontStatuses: { kind: "list", path: "/v1/customFronts/:system" },
  members: { kind: "list", path: "/v1/members/:system" },
  groups: { kind: "list", path: "/v1/groups/:system" },
  frontHistory: { kind: "list", path: "/v1/frontHistory" },
  comments: {
    kind: "unsupported",
    reason: "SP exposes comments per-document only (/v1/comments/:type/:id)",
  },
  notes: {
    kind: "dependent",
    parentCollection: "members",
    path: "/v1/notes/:system/:parent",
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
  return path.replaceAll(":system", encodeURIComponent(systemId));
}

/**
 * SP collection names the api source can fetch (list, single, or dependent).
 * Only `unsupported` collections are excluded — dependent collections are
 * reported so the engine does not emit a spurious `source-missing-collection`
 * warning for collections that ARE fetched via the dependent strategy.
 */
const FETCHABLE_COLLECTIONS: readonly SpCollectionName[] = (
  Object.keys(ENDPOINT_STRATEGIES) as SpCollectionName[]
).filter((name) => ENDPOINT_STRATEGIES[name].kind !== "unsupported");

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
 * - Shape failures on list responses (non-array body) →
 *   `ApiSourcePermanentError`. Per-document shape failures (non-object
 *   element, missing `_id`) are emitted as `drop` events so the engine
 *   can keep iterating the rest of the collection.
 *
 * SP streams full collections in a single response, so no pagination loop
 * is required. Collections without a bulk list endpoint yield nothing —
 * use the file source for a complete import.
 */
export function createApiImportSource(input: ApiSourceInput): ImportDataSource {
  const parentIdsByCollection = new Map<SpCollectionName, readonly string[]>();

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
            Authorization: input.token,
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

  function buildUrl(strategy: Exclude<ApiFetchStrategy, { kind: "unsupported" }>): string {
    const path = substituteSystem(strategy.path, input.systemId);
    return `${input.baseUrl}${path}`;
  }

  type AssertResult =
    | { readonly kind: "ok"; readonly sourceId: string; readonly record: Record<string, unknown> }
    | { readonly kind: "drop"; readonly sourceId: string | null; readonly reason: string };

  /**
   * SP's REST API wraps every document via `transformResultForClientRead`:
   *   `{ exists: true, id: <_id>, content: { ...fields } }`
   * Unwrap into a flat `{ _id, ...fields }` record so downstream mappers
   * see the same shape as the file-source (raw MongoDB export).
   */
  function unwrapSpEnvelope(raw: Record<string, unknown>): Record<string, unknown> {
    if ("content" in raw && "id" in raw && typeof raw.id === "string") {
      const content = raw.content;
      const fields = content !== null && typeof content === "object" ? toRecord(content) : {};
      return { _id: raw.id, ...fields };
    }
    return raw;
  }

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
    const record = unwrapSpEnvelope(toRecord(value));
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
    supplyParentIds(parentCollection: SpCollectionName, sourceIds: readonly string[]): void {
      parentIdsByCollection.set(parentCollection, sourceIds);
    },
    async *iterate(collection: SpCollectionName): AsyncGenerator<SourceEvent> {
      const strategy = ENDPOINT_STRATEGIES[collection];
      switch (strategy.kind) {
        case "unsupported":
          // The SP API does not expose a simple bulk endpoint for this
          // collection. Yield nothing so the engine keeps processing the
          // rest of DEPENDENCY_ORDER — operators who need these collections
          // should import from a file export instead.
          return;
        case "dependent": {
          const parentIds = parentIdsByCollection.get(strategy.parentCollection);
          if (!parentIds || parentIds.length === 0) {
            return;
          }

          for (const parentId of parentIds) {
            const path = substituteSystem(strategy.path, input.systemId).replaceAll(
              ":parent",
              encodeURIComponent(parentId),
            );
            const url = `${input.baseUrl}${path}`;

            let body: unknown;
            try {
              body = await fetchJson(url);
            } catch (err) {
              if (err instanceof ApiSourceTokenRejectedError) throw err;
              yield {
                kind: "drop",
                collection,
                sourceId: null,
                reason: `Failed to fetch ${collection} for parent ${parentId}: ${err instanceof Error ? err.message : String(err)}`,
              };
              continue;
            }

            if (!Array.isArray(body)) {
              yield {
                kind: "drop",
                collection,
                sourceId: null,
                reason: `SP API returned non-array for ${url} (got ${typeof body})`,
              };
              continue;
            }

            let index = 0;
            for (const element of body) {
              const result = assertDocument(element, collection, index);
              if (result.kind === "drop") {
                yield {
                  kind: "drop",
                  collection,
                  sourceId: result.sourceId,
                  reason: result.reason,
                };
              } else {
                yield {
                  kind: "doc",
                  collection,
                  sourceId: result.sourceId,
                  document: result.record,
                };
              }
              index += 1;
            }
          }
          return;
        }
        case "single": {
          const url = buildUrl(strategy);
          const body = await fetchJson(url);
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
        case "list": {
          const url = buildUrl(strategy);
          const body = await fetchJson(url);
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
          return;
        }
        default: {
          const _exhaustive: never = strategy;
          throw new Error(`unreachable ApiFetchStrategy kind: ${String(_exhaustive)}`);
        }
      }
    },
    listCollections() {
      // Only collections with a usable fetch strategy are reported.
      return Promise.resolve([...FETCHABLE_COLLECTIONS]);
    },
    async close(): Promise<void> {
      // No held resources — fetch is request-scoped.
    },
  };
}
