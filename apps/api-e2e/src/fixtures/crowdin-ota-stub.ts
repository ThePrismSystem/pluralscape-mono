import { createServer, type Server } from "node:http";

import type { AddressInfo } from "node:net";

/**
 * Local HTTP stub impersonating Crowdin's OTA distribution CDN.
 *
 * The real CDN hosts two resource shapes under a per-project distribution
 * hash:
 *   - `/{hash}/manifest.json`
 *   - `/{hash}/content/{locale}/{namespace}.json`
 *
 * E2E exercises the full proxy contract against this stub rather than the
 * live CDN so that:
 *   1. The suite doesn't fail when Crowdin is down / rate-limiting.
 *   2. Upstream failure modes (5xx, 404, malformed body) can be injected
 *      deterministically via `upstreamStatusFor`.
 *   3. Fixture content is stable across runs — no drift when translators
 *      push updates.
 *
 * The server binds to `127.0.0.1:0` so the OS picks a free port; the chosen
 * port is exposed via the `baseUrl`. Call `close()` from `afterAll` /
 * `globalTeardown` to release it.
 */

export interface CrowdinManifestFixture {
  readonly timestamp: number;
  readonly content: Readonly<Record<string, readonly string[]>>;
}

export interface CrowdinStubFixtures {
  readonly distributionHash: string;
  readonly manifest: CrowdinManifestFixture;
  /** Key format: `"<locale>/<namespace>"`, e.g. `"es/common"`. */
  readonly namespaces: Readonly<Record<string, Readonly<Record<string, string>>>>;
  /**
   * Optional override: return a non-default status for the given pathname.
   * Used by tests to exercise upstream failure branches (5xx → 502, etc.).
   * Return `undefined` to fall through to the normal manifest/namespace
   * handler.
   */
  readonly upstreamStatusFor?: (pathname: string) => number | undefined;
}

export interface CrowdinStub {
  readonly baseUrl: string;
  close(): Promise<void>;
}

const JSON_SUFFIX = ".json";
const HTTP_NOT_FOUND = 404;

export async function startCrowdinStub(fixtures: CrowdinStubFixtures): Promise<CrowdinStub> {
  const server: Server = createServer((req, res) => {
    const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "127.0.0.1"}`);
    const override = fixtures.upstreamStatusFor?.(url.pathname);
    if (override !== undefined) {
      res.statusCode = override;
      res.end();
      return;
    }

    const manifestPath = `/${fixtures.distributionHash}/manifest.json`;
    if (url.pathname === manifestPath) {
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify(fixtures.manifest));
      return;
    }

    const contentPrefix = `/${fixtures.distributionHash}/content/`;
    if (url.pathname.startsWith(contentPrefix) && url.pathname.endsWith(JSON_SUFFIX)) {
      const tail = url.pathname.slice(contentPrefix.length, -JSON_SUFFIX.length);
      const payload = fixtures.namespaces[tail];
      if (!payload) {
        res.statusCode = HTTP_NOT_FOUND;
        res.end();
        return;
      }
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify(payload));
      return;
    }

    res.statusCode = HTTP_NOT_FOUND;
    res.end();
  });

  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      resolve();
    });
  });
  const address = server.address();
  if (address === null || typeof address === "string") {
    throw new Error("Crowdin stub server bound to a non-TCP address");
  }
  const tcpAddress: AddressInfo = address;
  const baseUrl = `http://127.0.0.1:${String(tcpAddress.port)}`;

  return {
    baseUrl,
    close(): Promise<void> {
      return new Promise<void>((resolve, reject) => {
        server.close((err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    },
  };
}
