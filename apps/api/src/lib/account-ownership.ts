import { HTTP_NOT_FOUND } from "../http.constants.js";

import { ApiHttpError } from "./api-error.js";

import type { AuthContext } from "./auth-context.js";
import type { AccountId } from "@pluralscape/types";

/**
 * Verify that the given account is the authenticated account.
 * Throws 404 NOT_FOUND on miss (never 403, to avoid revealing existence).
 */
export function assertAccountOwnership(accountId: AccountId, auth: AuthContext): void {
  if (auth.accountId !== accountId) {
    throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", "Account not found");
  }
}
