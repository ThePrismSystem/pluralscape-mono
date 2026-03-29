import {
  WEBHOOK_DELIVERY_TIMEOUT_MS,
  WEBHOOK_SIGNATURE_HEADER,
  WEBHOOK_TIMESTAMP_HEADER,
} from "../service.constants.js";

/** Options for sending a signed webhook request. */
export interface SignedWebhookRequestOptions {
  /** The target URL. */
  readonly url: string;
  /** Hex-encoded HMAC signature. */
  readonly signature: string;
  /** Unix-seconds delivery timestamp. */
  readonly timestamp: number;
  /** JSON-serialized payload body. */
  readonly payloadJson: string;
  /** Fetch implementation (defaults to global fetch). */
  readonly fetchFn?: (input: string | URL | Request, init?: RequestInit) => Promise<Response>;
  /** Request timeout in milliseconds. */
  readonly timeoutMs?: number;
  /** Host header override (for IP-pinned requests). */
  readonly hostHeader?: string;
}

/** Successful response from a signed webhook request. */
export interface WebhookFetchSuccess {
  readonly httpStatus: number;
}

/** Error response from a signed webhook request. */
export interface WebhookFetchError {
  readonly error: "timeout" | "network";
}

/** Result of a signed webhook request — either a status code or an error classification. */
export type WebhookFetchResult = WebhookFetchSuccess | WebhookFetchError;

/**
 * Send an HTTP POST with HMAC signature headers to a webhook endpoint.
 *
 * Encapsulates: AbortController timeout, fetch call, signature/timestamp
 * headers, and error classification. Used by both the test-ping endpoint
 * and the delivery worker.
 */
export async function sendSignedWebhookRequest(
  opts: SignedWebhookRequestOptions,
): Promise<WebhookFetchResult> {
  const fetchFn = opts.fetchFn ?? fetch;
  const timeoutMs = opts.timeoutMs ?? WEBHOOK_DELIVERY_TIMEOUT_MS;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    [WEBHOOK_SIGNATURE_HEADER]: opts.signature,
    [WEBHOOK_TIMESTAMP_HEADER]: String(opts.timestamp),
  };

  if (opts.hostHeader) {
    headers["Host"] = opts.hostHeader;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  try {
    const response = await fetchFn(opts.url, {
      method: "POST",
      headers,
      body: opts.payloadJson,
      signal: controller.signal,
    });
    return { httpStatus: response.status };
  } catch (error: unknown) {
    if (error instanceof DOMException && error.name === "AbortError") {
      return { error: "timeout" };
    }
    if (error instanceof TypeError) {
      return { error: "network" };
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
