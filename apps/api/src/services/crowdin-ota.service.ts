import { I18N_OTA_TIMEOUT_MS } from "@pluralscape/types";
import { z } from "zod/v4";

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

/**
 * Zod schema for the Crowdin OTA `manifest.json` payload. Validated at the
 * trust boundary so malformed payloads are caught before they can leak
 * into downstream consumers.
 */
const CrowdinManifestSchema = z.object({
  timestamp: z.number(),
  content: z.record(z.string(), z.array(z.string())),
});

/**
 * Zod schema for `content/{locale}/{namespace}.json`. A flat
 * string-to-string map — any deviation surfaces as a 502 upstream error.
 */
const CrowdinNamespaceSchema = z.record(z.string(), z.string());

/**
 * HTTP status we emit when the CDN responds with JSON that fails schema
 * validation. 502 Bad Gateway communicates "upstream is broken" rather
 * than masking the failure as a 500 (our own server fault).
 */
const MALFORMED_UPSTREAM_STATUS = 502;

type CrowdinManifestResponse = z.infer<typeof CrowdinManifestSchema>;

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
 * Responses are validated at the trust boundary with Zod. Malformed payloads
 * surface as `CrowdinOtaUpstreamError(status: 502)` so the consuming route
 * produces the same UPSTREAM_UNAVAILABLE envelope as a genuine Crowdin 5xx.
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
    const parsed = CrowdinManifestSchema.safeParse(json);
    if (!parsed.success) {
      throw new CrowdinOtaUpstreamError(
        `malformed Crowdin manifest: ${parsed.error.message}`,
        MALFORMED_UPSTREAM_STATUS,
      );
    }
    return parsed.data;
  }

  async fetchNamespace(
    locale: string,
    namespace: string,
  ): Promise<Readonly<Record<string, string>>> {
    const url = `${this.baseUrl}/${this.distributionHash}/content/${locale}/${namespace}.json`;
    const json = await this.fetchJson(url);
    const parsed = CrowdinNamespaceSchema.safeParse(json);
    if (!parsed.success) {
      throw new CrowdinOtaUpstreamError(
        `malformed Crowdin namespace ${locale}/${namespace}: ${parsed.error.message}`,
        MALFORMED_UPSTREAM_STATUS,
      );
    }
    return parsed.data;
  }

  private async fetchJson(url: string): Promise<unknown> {
    const controller = new AbortController();
    // Use a local flag rather than inspecting `controller.signal.aborted` so
    // that an external abort (e.g., the caller's own AbortSignal being fed
    // into a composed controller in a future refactor) isn't misclassified
    // as a timeout. Only our own setTimeout sets this flag. The flag lives
    // on an object with a getter so ESLint's control-flow analysis doesn't
    // pre-narrow the bare `let` to `never` (no-unnecessary-condition).
    const timeout = {
      fired: false,
      didFire(): boolean {
        return this.fired;
      },
    };
    const timer = setTimeout(() => {
      timeout.fired = true;
      controller.abort();
    }, this.timeoutMs);
    try {
      const res = await this.fetchImpl(url, { signal: controller.signal });
      if (!res.ok) {
        throw new CrowdinOtaUpstreamError(`Crowdin OTA ${String(res.status)}: ${url}`, res.status);
      }
      return await res.json();
    } catch (error: unknown) {
      if (timeout.didFire()) {
        throw new CrowdinOtaTimeoutError(this.timeoutMs);
      }
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }
}
