import {
  AVATAR_CONCURRENCY,
  AVATAR_MAX_BYTES,
  AVATAR_REQUEST_TIMEOUT_MS,
} from "./import-sp-mobile.constants.js";

import type { AvatarFetchResult, AvatarFetcher } from "@pluralscape/import-sp/avatar-fetcher-types";
import type JSZip from "jszip";

const HTTP_NOT_FOUND = 404;
const MIN_HTTP_OK = 200;
const MAX_HTTP_OK = 299;
const DEFAULT_CONTENT_TYPE = "application/octet-stream";
const SIZE_ERROR_MESSAGE = "avatar exceeds maximum size";
const TIMEOUT_ERROR_MESSAGE = "avatar fetch timed out";

/**
 * Content-type mappings for common avatar extensions found in SP ZIP exports.
 *
 * JSZip does not expose MIME metadata, so we derive it from the filename
 * suffix. Unknown extensions fall back to `application/octet-stream`.
 */
const EXTENSION_CONTENT_TYPES: Readonly<Record<string, string>> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  bmp: "image/bmp",
  svg: "image/svg+xml",
};

function isAbortError(err: unknown): boolean {
  return err instanceof Error && err.name === "AbortError";
}

function errorMessage(err: unknown): string {
  if (err instanceof Error) {
    return err.message;
  }
  return String(err);
}

/**
 * Drains a response body while enforcing a byte cap. Returns null if the cap
 * is exceeded so the caller can emit a size error without retaining the
 * partial payload.
 */
async function readBodyWithCap(response: Response, maxBytes: number): Promise<Uint8Array | null> {
  const reader = response.body?.getReader();
  if (reader === undefined) {
    // No stream — fall back to arrayBuffer and check after the fact.
    const buffer = new Uint8Array(await response.arrayBuffer());
    if (buffer.byteLength > maxBytes) {
      return null;
    }
    return buffer;
  }

  const chunks: Uint8Array[] = [];
  let total = 0;
  let done = false;
  while (!done) {
    const { done: streamDone, value } = await reader.read();
    done = streamDone;
    if (value !== undefined) {
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel();
        return null;
      }
      chunks.push(value);
    }
  }

  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return out;
}

async function fetchAvatarViaApi(url: string): Promise<AvatarFetchResult> {
  const controller = new AbortController();
  const timeoutHandle = setTimeout(() => {
    controller.abort();
  }, AVATAR_REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, { signal: controller.signal });

    if (response.status === HTTP_NOT_FOUND) {
      return { status: "not-found" };
    }
    if (response.status < MIN_HTTP_OK || response.status > MAX_HTTP_OK) {
      return {
        status: "error",
        message: `avatar fetch failed with status ${String(response.status)}`,
      };
    }

    const contentLengthHeader = response.headers.get("content-length");
    if (contentLengthHeader !== null) {
      const declared = Number.parseInt(contentLengthHeader, 10);
      if (Number.isFinite(declared) && declared > AVATAR_MAX_BYTES) {
        return { status: "error", message: SIZE_ERROR_MESSAGE };
      }
    }

    const bytes = await readBodyWithCap(response, AVATAR_MAX_BYTES);
    if (bytes === null) {
      return { status: "error", message: SIZE_ERROR_MESSAGE };
    }

    const contentType = response.headers.get("content-type") ?? DEFAULT_CONTENT_TYPE;
    return { status: "ok", bytes, contentType };
  } catch (err) {
    if (isAbortError(err)) {
      return { status: "error", message: TIMEOUT_ERROR_MESSAGE };
    }
    return { status: "error", message: errorMessage(err) };
  } finally {
    clearTimeout(timeoutHandle);
  }
}

/**
 * Hand-rolled concurrency limiter.
 *
 * Keeps a counter of in-flight tasks and a FIFO queue of waiters. Each acquire
 * resolves immediately if there is a free slot, otherwise enqueues a resolver
 * that will be invoked when another task releases its slot. Used instead of
 * a third-party library to keep the mobile bundle lean.
 */
function createLimiter(limit: number): {
  readonly run: <T>(task: () => Promise<T>) => Promise<T>;
} {
  let active = 0;
  const waiters: Array<() => void> = [];

  async function acquire(): Promise<void> {
    if (active < limit) {
      active += 1;
      return;
    }
    await new Promise<void>((resolve) => {
      waiters.push(() => {
        active += 1;
        resolve();
      });
    });
  }

  function release(): void {
    active -= 1;
    const next = waiters.shift();
    if (next !== undefined) {
      next();
    }
  }

  return {
    async run<T>(task: () => Promise<T>): Promise<T> {
      await acquire();
      try {
        return await task();
      } finally {
        release();
      }
    },
  };
}

/**
 * Extracts the file extension from a zip entry path, lowercased and without
 * the leading dot. Returns an empty string if no extension is present.
 */
function extensionOf(path: string): string {
  const slash = path.lastIndexOf("/");
  const base = slash === -1 ? path : path.slice(slash + 1);
  const dot = base.lastIndexOf(".");
  if (dot === -1) {
    return "";
  }
  return base.slice(dot + 1).toLowerCase();
}

/**
 * Returns the zip entry whose filename (sans extension) equals `key`.
 *
 * JSZip stores entries under their full path; SP exports keep avatars at
 * `avatars/{id}.{ext}`. We scan once per lookup — the export footprint is
 * small enough that a prebuilt index adds complexity without measurable
 * benefit.
 */
function findZipEntry(zip: JSZip, key: string): { path: string; file: JSZip.JSZipObject } | null {
  for (const [path, file] of Object.entries(zip.files)) {
    if (file.dir) {
      continue;
    }
    const slash = path.lastIndexOf("/");
    const base = slash === -1 ? path : path.slice(slash + 1);
    const dot = base.lastIndexOf(".");
    const stem = dot === -1 ? base : base.slice(0, dot);
    if (stem === key) {
      return { path, file };
    }
  }
  return null;
}

async function fetchAvatarViaZip(zip: JSZip, key: string): Promise<AvatarFetchResult> {
  const hit = findZipEntry(zip, key);
  if (hit === null) {
    return { status: "not-found" };
  }

  const raw = await hit.file.async("uint8array");
  if (raw.byteLength > AVATAR_MAX_BYTES) {
    return { status: "error", message: SIZE_ERROR_MESSAGE };
  }

  const ext = extensionOf(hit.path);
  const contentType = EXTENSION_CONTENT_TYPES[ext] ?? DEFAULT_CONTENT_TYPE;
  return { status: "ok", bytes: raw, contentType };
}

/**
 * Arguments for `createMobileAvatarFetcher`.
 *
 * - `api` — download via HTTPS using the URL SP publishes per member/system.
 * - `zip` — read from a loaded JSZip instance (companion export file).
 * - `skip` — synthesize `not-found` for every key, used when the user opts
 *   out of avatar import entirely.
 */
export type MobileAvatarFetcherArgs =
  | { readonly mode: "api" }
  | { readonly mode: "zip"; readonly zip: JSZip }
  | { readonly mode: "skip" };

/**
 * Creates an `AvatarFetcher` for mobile clients.
 *
 * Dispatches to API, ZIP, or skip implementations based on the caller's
 * chosen mode. API and ZIP modes share the same concurrency limiter so the
 * persister cannot exhaust the device's resources regardless of source.
 */
export function createMobileAvatarFetcher(args: MobileAvatarFetcherArgs): AvatarFetcher {
  const limiter = createLimiter(AVATAR_CONCURRENCY);

  return {
    async fetchAvatar(key: string): Promise<AvatarFetchResult> {
      switch (args.mode) {
        case "api":
          return limiter.run(() => fetchAvatarViaApi(key));
        case "zip": {
          const { zip } = args;
          return limiter.run(() => fetchAvatarViaZip(zip, key));
        }
        case "skip":
          return { status: "not-found" };
        default:
          return args satisfies never;
      }
    },
  };
}
