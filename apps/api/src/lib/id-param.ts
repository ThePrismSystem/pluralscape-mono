import { HTTP_BAD_REQUEST } from "../http.constants.js";

import { ApiHttpError } from "./api-error.js";
import { UUID_V4_PATTERN } from "./id-param.constants.js";

import type { Brand, IdPrefixBrandMap } from "@pluralscape/types";

/**
 * Validates that a route parameter matches the expected branded ID format:
 * `<prefix><uuid-v4>`. Throws 400 VALIDATION_ERROR on mismatch.
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
  if (!UUID_V4_PATTERN.test(uuid)) {
    throw new ApiHttpError(
      HTTP_BAD_REQUEST,
      "VALIDATION_ERROR",
      "Invalid ID format: malformed UUID",
    );
  }

  return raw as Brand<string, IdPrefixBrandMap[P]>;
}
