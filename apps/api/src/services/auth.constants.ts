/**
 * Shared auth service constants.
 * Domain: service layer (account + recovery key operations).
 */

import { brandId } from "@pluralscape/types";

import type { AccountId } from "@pluralscape/types";

/** Generic error for incorrect password on authenticated operations. */
export const INCORRECT_PASSWORD_ERROR = "Incorrect password";

/**
 * Zeroed account ID used as the audit actor when no real account exists.
 * Ensures the anti-enumeration code path writes an audit event with a
 * structurally valid but obviously synthetic account reference.
 */
export const ANTI_ENUM_SENTINEL_ACCOUNT_ID = brandId<AccountId>(
  "acct_00000000-0000-0000-0000-000000000000",
);
