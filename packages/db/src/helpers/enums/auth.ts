/**
 * Auth, account, and key const arrays for varchar CHECK constraints.
 * Values sourced from @pluralscape/types union types.
 */

import {
  type AccountPurgeStatus,
  type AccountType,
  type AuthKeyType,
  type DeviceTransferStatus,
  type RotationItemStatus,
  type RotationState,
} from "@pluralscape/types";

export const ACCOUNT_TYPES = ["system", "viewer"] as const satisfies readonly AccountType[];

export const ACCOUNT_PURGE_STATUSES = [
  "pending",
  "confirmed",
  "processing",
  "completed",
  "cancelled",
] as const satisfies readonly AccountPurgeStatus[];

export const AUTH_KEY_TYPES = ["encryption", "signing"] as const satisfies readonly AuthKeyType[];

export const DEVICE_TRANSFER_STATUSES = [
  "pending",
  "approved",
  "expired",
] as const satisfies readonly DeviceTransferStatus[];

export const ROTATION_STATES = [
  "initiated",
  "migrating",
  "sealing",
  "completed",
  "failed",
] as const satisfies readonly RotationState[];

export const ROTATION_ITEM_STATUSES = [
  "pending",
  "claimed",
  "completed",
  "failed",
] as const satisfies readonly RotationItemStatus[];
