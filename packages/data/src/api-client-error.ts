/**
 * Structured error for API client failures.
 *
 * Exposes only `code` and `message` — does NOT include raw API response
 * details, preventing internal API structure from leaking to UI or crash reports.
 */
export class ApiClientError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "ApiClientError";
    this.code = code;
  }
}
