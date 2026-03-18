import { HTTP_BAD_REQUEST } from "../http.constants.js";

import { ApiHttpError } from "./api-error.js";
import { UUID_PATTERN } from "./id-param.constants.js";

import type { Brand, IdPrefixBrandMap } from "@pluralscape/types";

/**
 * Extracts a required route parameter. Throws 400 if missing.
 * Use for params inherited from a parent router mount (e.g. `/:id/settings`).
 */
export function requireParam(raw: string | undefined, name: string): string {
  if (!raw) {
    throw new ApiHttpError(
      HTTP_BAD_REQUEST,
      "VALIDATION_ERROR",
      `Missing required parameter: ${name}`,
    );
  }
  return raw;
}

/**
 * Validates that a route parameter matches the expected branded ID format:
 * `<prefix><uuid>`. Throws 400 VALIDATION_ERROR on mismatch.
 */
export function parseIdParam<P extends keyof IdPrefixBrandMap>(
  raw: string,
  expectedPrefix: P,
): Brand<string, IdPrefixBrandMap[P]> {
  if (!raw.startsWith(expectedPrefix)) {
    throw new ApiHttpError(
      HTTP_BAD_REQUEST,
      "VALIDATION_ERROR",
      `Invalid ID format: expected prefix "${expectedPrefix}"`,
    );
  }

  const uuid = raw.slice(expectedPrefix.length);
  if (!UUID_PATTERN.test(uuid)) {
    throw new ApiHttpError(
      HTTP_BAD_REQUEST,
      "VALIDATION_ERROR",
      "Invalid ID format: malformed UUID",
    );
  }

  return raw as Brand<string, IdPrefixBrandMap[P]>;
}

/**
 * Combines `requireParam` and `parseIdParam` for route parameters inherited
 * from a parent router mount. Throws 400 if missing or malformed.
 */
export function requireIdParam<P extends keyof IdPrefixBrandMap>(
  raw: string | undefined,
  name: string,
  expectedPrefix: P,
): Brand<string, IdPrefixBrandMap[P]> {
  return parseIdParam(requireParam(raw, name), expectedPrefix);
}
