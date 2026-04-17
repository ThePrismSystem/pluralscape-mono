import { I18N_OTA_TIMEOUT_MS } from "@pluralscape/types";

/**
 * Thrown when the Crowdin OTA CDN returns a non-2xx status.
 * Preserves the upstream HTTP status so the caller can map it to an
 * appropriate downstream response (e.g., 502 for 5xx, 404 for 404).
 */
export class CrowdinOtaUpstreamError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "CrowdinOtaUpstreamError";
  }
}

/**
 * Thrown when a Crowdin OTA fetch exceeds the configured timeout.
 * Distinguishes between network-slow (which we can degrade gracefully
 * with cached content) and actual CDN errors.
 */
export class CrowdinOtaTimeoutError extends Error {
  constructor(public readonly timeoutMs: number) {
    super(`Crowdin OTA fetch timed out after ${String(timeoutMs)}ms`);
    this.name = "CrowdinOtaTimeoutError";
  }
}

interface CrowdinManifestResponse {
  readonly timestamp: number;
  readonly content: Readonly<Record<string, readonly string[]>>;
}

/**
 * Narrow fetch signature — we only ever call it as
 * `fetch(url, { signal })`. Using `typeof fetch` here forced every
 * test fixture to also carry `preconnect`, which added no value.
 */
export type CrowdinOtaFetch = (url: string, init?: { signal?: AbortSignal }) => Promise<Response>;

interface CrowdinOtaServiceOptions {
  readonly distributionHash: string;
  readonly fetch?: CrowdinOtaFetch;
  readonly timeoutMs?: number;
  readonly baseUrl?: string;
}

const DEFAULT_BASE_URL = "https://distributions.crowdin.net";

/**
 * Thin wrapper around Crowdin's OTA distribution CDN.
 *
 * The OTA CDN hosts two resource shapes under a per-project distribution hash:
 *  - `manifest.json` — enumerates locales and their namespaces plus a timestamp
 *  - `content/{locale}/{namespace}.json` — flat key/value translation map
 *
 * Responses are treated as trust-boundary data. The cast-to-shape in
 * fetchManifest/fetchNamespace is intentional: runtime validation of the CDN
 * payload is deferred to a follow-up ADR, and the consuming route will still
 * produce a safe error envelope on any downstream parse/access failure.
 */
export class CrowdinOtaService {
  private readonly distributionHash: string;
  private readonly fetchImpl: CrowdinOtaFetch;
  private readonly timeoutMs: number;
  private readonly baseUrl: string;

  constructor(options: CrowdinOtaServiceOptions) {
    this.distributionHash = options.distributionHash;
    this.fetchImpl = options.fetch ?? globalThis.fetch;
    this.timeoutMs = options.timeoutMs ?? I18N_OTA_TIMEOUT_MS;
    this.baseUrl = options.baseUrl ?? DEFAULT_BASE_URL;
  }

  async fetchManifest(): Promise<CrowdinManifestResponse> {
    const url = `${this.baseUrl}/${this.distributionHash}/manifest.json`;
    const json = await this.fetchJson(url);
    return json as CrowdinManifestResponse;
  }

  async fetchNamespace(
    locale: string,
    namespace: string,
  ): Promise<Readonly<Record<string, string>>> {
    const url = `${this.baseUrl}/${this.distributionHash}/content/${locale}/${namespace}.json`;
    const json = await this.fetchJson(url);
    return json as Readonly<Record<string, string>>;
  }

  private async fetchJson(url: string): Promise<unknown> {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      controller.abort();
    }, this.timeoutMs);
    try {
      const res = await this.fetchImpl(url, { signal: controller.signal });
      if (!res.ok) {
        throw new CrowdinOtaUpstreamError(`Crowdin OTA ${String(res.status)}: ${url}`, res.status);
      }
      return await res.json();
    } catch (error: unknown) {
      if (controller.signal.aborted) {
        throw new CrowdinOtaTimeoutError(this.timeoutMs);
      }
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }
}
