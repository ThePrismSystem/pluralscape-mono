import { I18N_OTA_TIMEOUT_MS } from "@pluralscape/types";
import { z } from "zod/v4";

import { assertSafeLocaleAndNamespace } from "../routes/i18n/schemas.js";

/**
 * Tagged-union description of every Crowdin OTA failure mode.
 *
 * Split by cause rather than by HTTP status so callers can pattern-match on
 * semantics (is this a timeout? a non-2xx upstream response? a malformed
 * payload?) without string-sniffing `Error.message`. The exhaustive switch
 * idiom (`default: return detail satisfies never`) surfaces any new variant
 * at compile time the first time a caller forgets to handle it.
 *
 *  - `timeout`   — our AbortController fired because the upstream fetch
 *                  exceeded `timeoutMs`.
 *  - `upstream`  — Crowdin returned a non-2xx HTTP status. `status` is the
 *                  raw upstream HTTP status; callers map 404 to their own
 *                  "not found" envelope and anything else to 502.
 *  - `malformed` — Crowdin returned 2xx but the JSON body failed Zod
 *                  validation. Distinct from `upstream` so observability
 *                  can count "CDN lied to us" separately from "CDN is
 *                  genuinely down"; callers treat both as 502 at the
 *                  response boundary.
 */
export type CrowdinOtaErrorDetail =
  | { readonly kind: "timeout"; readonly timeoutMs: number }
  | { readonly kind: "upstream"; readonly status: number; readonly message: string }
  | { readonly kind: "malformed"; readonly reason: string };

/**
 * Unified error type for every Crowdin OTA failure. Callers switch on
 * `detail.kind` rather than `instanceof` against multiple classes.
 *
 * The `name` field is stable across variants so structured test matchers
 * (`rejects.toMatchObject({ name: "CrowdinOtaFailure", detail: {...} })`)
 * keep working when new variants are added.
 */
export class CrowdinOtaFailure extends Error {
  readonly detail: CrowdinOtaErrorDetail;

  constructor(detail: CrowdinOtaErrorDetail) {
    super(messageFor(detail));
    this.name = "CrowdinOtaFailure";
    this.detail = detail;
  }
}

function messageFor(detail: CrowdinOtaErrorDetail): string {
  switch (detail.kind) {
    case "timeout":
      return `Crowdin OTA fetch timed out after ${String(detail.timeoutMs)}ms`;
    case "upstream":
      return detail.message;
    case "malformed":
      return detail.reason;
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
 * Responses are validated at the trust boundary with Zod. Every failure
 * surfaces as `CrowdinOtaFailure` with a tagged `detail` describing the
 * specific cause (timeout, upstream non-2xx, malformed payload).
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
      throw new CrowdinOtaFailure({
        kind: "malformed",
        reason: `malformed Crowdin manifest: ${parsed.error.message}`,
      });
    }
    return parsed.data;
  }

  async fetchNamespace(
    locale: string,
    namespace: string,
  ): Promise<Readonly<Record<string, string>>> {
    // Defence-in-depth: even though the REST/tRPC layers validate the same
    // fields, a future internal caller (background job, admin tool) MUST
    // NOT be able to smuggle path-traversal segments into the CDN URL.
    // `assertSafeLocaleAndNamespace` throws a ZodError on invalid input.
    assertSafeLocaleAndNamespace(locale, namespace);
    const url = `${this.baseUrl}/${this.distributionHash}/content/${locale}/${namespace}.json`;
    const json = await this.fetchJson(url);
    const parsed = CrowdinNamespaceSchema.safeParse(json);
    if (!parsed.success) {
      throw new CrowdinOtaFailure({
        kind: "malformed",
        reason: `malformed Crowdin namespace ${locale}/${namespace}: ${parsed.error.message}`,
      });
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
        throw new CrowdinOtaFailure({
          kind: "upstream",
          status: res.status,
          message: `Crowdin OTA ${String(res.status)}: ${url}`,
        });
      }
      return await res.json();
    } catch (error: unknown) {
      if (timeout.didFire()) {
        throw new CrowdinOtaFailure({ kind: "timeout", timeoutMs: this.timeoutMs });
      }
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }
}
