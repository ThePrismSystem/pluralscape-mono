import type { ApiErrorCode } from "@pluralscape/types";

/**
 * Structured error for API client failures.
 *
 * Exposes only `code`, `message`, and `path` — does NOT include raw API
 * response details, preventing internal API structure from leaking to UI
 * or crash reports.
 */
export class ApiClientError extends Error {
  readonly code: ApiErrorCode | "UNKNOWN";
  readonly path: string | undefined;

  constructor(code: ApiErrorCode | "UNKNOWN", message: string, path?: string) {
    super(message);
    this.name = "ApiClientError";
    this.code = code;
    this.path = path;
  }
}
