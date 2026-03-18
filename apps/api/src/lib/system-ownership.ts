import { HTTP_NOT_FOUND } from "../http.constants.js";

import { ApiHttpError } from "./api-error.js";

import type { AuthContext } from "./auth-context.js";
import type { SystemId } from "@pluralscape/types";

/**
 * Verify that the given system is owned by the authenticated account and is not archived.
 * Throws 404 NOT_FOUND on miss (never 403, to avoid revealing existence).
 *
 * Uses the pre-populated ownedSystemIds set from the auth context — no DB query needed.
 */
export function assertSystemOwnership(systemId: SystemId, auth: AuthContext): void {
  if (!auth.ownedSystemIds.has(systemId)) {
    throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", "System not found");
  }
}
