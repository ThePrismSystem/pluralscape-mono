import {
  SP_API_BACKOFF_BASE_MS,
  SP_API_BACKOFF_MAX_MS,
  SP_API_MAX_RETRIES,
  SP_API_PAGE_SIZE,
  SP_API_REQUEST_TIMEOUT_MS,
} from "../import-sp.constants.js";

import type { ImportSource, SourceDocument } from "./source.types.js";
import type { SpCollectionName } from "./sp-collections.js";

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
 * Mapping from internal SP collection name to the SP REST endpoint path.
 *
 * These paths are a best-effort derived from SP naming conventions. They are
 * **not** verified against a running SP server here — Plan 3's mobile E2E
 * tests will validate each path against the real API and any mismatches are
 * corrected there. Do not treat this map as canonical until that validation
 * lands.
 */
const ENDPOINT_PATHS: Record<SpCollectionName, string> = {
  users: "/v1/user",
  private: "/v1/user/private",
  privacyBuckets: "/v1/privacyBuckets",
  customFields: "/v1/customFields",
  frontStatuses: "/v1/customFronts",
  members: "/v1/members",
  groups: "/v1/groups",
  frontHistory: "/v1/frontHistory",
  comments: "/v1/comments",
  notes: "/v1/notes",
  polls: "/v1/polls",
  channelCategories: "/v1/channelCategories",
  channels: "/v1/channels",
  chatMessages: "/v1/chatMessages",
  boardMessages: "/v1/boardMessages",
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
  readonly pageSize?: number;
}

function delayMs(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function backoffFor(attempt: number): number {
  return Math.min(SP_API_BACKOFF_BASE_MS * BACKOFF_EXPONENT_BASE ** attempt, SP_API_BACKOFF_MAX_MS);
}

/**
 * Create an `ImportSource` that streams a Simply Plural account by paginating
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
 *
 * Pagination stops when the server returns an empty page. We deliberately do
 * **not** stop on a short page because SP's exact page-size semantics have not
 * been verified end-to-end yet.
 */
export function createApiImportSource(input: ApiSourceInput): ImportSource {
  const pageSize = input.pageSize ?? SP_API_PAGE_SIZE;

  async function fetchWithRetry(url: string): Promise<unknown[]> {
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

      const body: unknown = await response.json();
      if (!Array.isArray(body)) {
        throw new ApiSourceTransientError(
          `SP API returned non-array body for ${url} (got ${typeof body})`,
        );
      }
      // Array.isArray narrows to any[] which violates no-unsafe-return; an
      // unknown[] is the correct shape since individual elements are still
      // validated downstream by Zod.
      const typedBody: unknown[] = body;
      return typedBody;
    }
    // Unreachable — the loop exits via `return body` or a thrown error — but
    // keep an explicit throw so TypeScript's control-flow analysis is happy.
    throw new ApiSourceTransientError("retry loop exhausted");
  }

  return {
    mode: "api",
    async *iterate(collection: SpCollectionName): AsyncGenerator<SourceDocument> {
      const path = ENDPOINT_PATHS[collection];
      // Pagination loop: request pages until the server returns an empty
      // array. `for (;;)` avoids the `while (true)` no-unnecessary-condition
      // lint error.
      for (let page = 0; ; page++) {
        const offset = page * pageSize;
        const url = `${input.baseUrl}${path}?limit=${String(pageSize)}&offset=${String(offset)}`;
        const docs = await fetchWithRetry(url);
        if (docs.length === 0) {
          return;
        }
        for (const document of docs) {
          const sourceId = (document as { _id?: unknown })._id;
          if (typeof sourceId !== "string" || sourceId.length === 0) {
            throw new ApiSourceTransientError(
              `ApiImportSource: ${collection} document missing _id`,
            );
          }
          yield { collection, sourceId, document };
        }
      }
    },
    async close(): Promise<void> {
      // No held resources — fetch is request-scoped.
    },
  };
}
