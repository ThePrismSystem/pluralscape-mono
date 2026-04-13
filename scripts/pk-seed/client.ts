/**
 * PK API client for seed script mutations.
 *
 * Uses direct `fetch` calls against the PK API v2 (pkapi.js is not hoisted to
 * the monorepo root, so we avoid importing it here).
 *
 * Rate-limits mutations to stay under PK's 3-writes/sec limit.
 */

import { FETCH_TIMEOUT_MS, MUTATION_DELAY_MS, PK_API_BASE_URL_DEFAULT } from "./constants.js";

export class PkApiError extends Error {
  constructor(
    readonly status: number,
    readonly method: string,
    readonly path: string,
    readonly body: string,
  ) {
    super(`PK API ${method} ${path} failed (${status}): ${body.slice(0, 200)}`);
    this.name = "PkApiError";
  }
}

export class UnresolvedRefError extends Error {
  constructor(readonly ref: string) {
    super(`Unresolved fixture ref: "${ref}"`);
    this.name = "UnresolvedRefError";
  }
}

export class LegacyManifestError extends Error {
  constructor(readonly manifestPath: string) {
    super(`manifest format out of date — delete ${manifestPath} and re-run to regenerate`);
    this.name = "LegacyManifestError";
  }
}

interface RequestOptions {
  method?: string;
  body?: unknown;
}

const RETRY_BACKOFF_MS = 500;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class PkClient {
  private inflight: Promise<void> = Promise.resolve();

  constructor(
    private readonly token: string,
    private readonly baseUrl: string = PK_API_BASE_URL_DEFAULT,
  ) {}

  /**
   * Verify the stored token is still valid by fetching the current system.
   * Returns the system id on success, undefined on auth failure.
   */
  async verifyToken(): Promise<string | undefined> {
    try {
      const data = await this.request<{ id: string }>("/v2/systems/@me", {});
      return data.id;
    } catch (err) {
      if (err instanceof PkApiError && err.status === 401) {
        return undefined;
      }
      throw err;
    }
  }

  async createMember(body: Record<string, unknown>): Promise<{ id: string }> {
    return this.mutate<{ id: string }>("/v2/members", body);
  }

  async patchMember(memberId: string, body: Record<string, unknown>): Promise<void> {
    await this.mutate(`/v2/members/${memberId}`, body, "PATCH");
  }

  async createGroup(body: Record<string, unknown>): Promise<{ id: string }> {
    return this.mutate<{ id: string }>("/v2/groups", body);
  }

  async addGroupMembers(groupId: string, memberIds: readonly string[]): Promise<void> {
    await this.mutate(`/v2/groups/${groupId}/members/add`, memberIds, "POST");
  }

  async createSwitch(body: { members: readonly string[]; timestamp?: string }): Promise<{
    id: string;
    timestamp: string;
    members: { id: string }[];
  }> {
    return this.mutate("/v2/systems/@me/switches", body);
  }

  /** Probe whether an entity still exists. Returns true on 200, false on 404. */
  async probe(path: string): Promise<boolean> {
    try {
      await this.request(path, {});
      return true;
    } catch (err) {
      if (err instanceof PkApiError && err.status === 404) {
        return false;
      }
      throw err;
    }
  }

  private async mutate<T>(path: string, body: unknown, method = "POST"): Promise<T> {
    const previous = this.inflight;
    let release!: () => void;
    this.inflight = new Promise<void>((r) => {
      release = r;
    });
    try {
      await previous;
      await delay(MUTATION_DELAY_MS);
      return await this.executeOnce<T>(path, { method, body }, true);
    } finally {
      release();
    }
  }

  async request<T>(path: string, opts: RequestOptions): Promise<T> {
    return this.executeOnce<T>(path, opts, true);
  }

  private async executeOnce<T>(
    path: string,
    opts: RequestOptions,
    retryOn5xx: boolean,
  ): Promise<T> {
    const method = opts.method ?? "GET";
    const url = `${this.baseUrl}${path}`;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Authorization: this.token,
    };
    const init: RequestInit = {
      method,
      headers,
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    };
    if (opts.body !== undefined) {
      init.body = JSON.stringify(opts.body);
    }
    const response = await fetch(url, init);
    if (response.status >= 500 && retryOn5xx) {
      await delay(RETRY_BACKOFF_MS);
      return this.executeOnce(path, opts, false);
    }
    const text = await response.text();
    if (!response.ok) {
      throw new PkApiError(response.status, method, path, text);
    }
    if (!text) {
      if (response.status === 204) {
        return undefined as T;
      }
      throw new Error(
        `Empty response body from ${method} ${path} (status ${String(response.status)})`,
      );
    }
    try {
      return JSON.parse(text) as T;
    } catch (parseError: unknown) {
      // Non-JSON response body — return raw text.
      // This is expected for some PK API endpoints that return plain strings.
      return text as T;
    }
  }
}
