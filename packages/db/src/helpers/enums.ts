/**
 * Const arrays for varchar CHECK constraints.
 * Values sourced from @pluralscape/types union types.
 * Used in both PG and SQLite table definitions.
 */

import type { CompletenessLevel } from "@pluralscape/types";
import type { FrontingType } from "@pluralscape/types";
import type { RelationshipType } from "@pluralscape/types";
import type { LayerAccessType } from "@pluralscape/types";
import type { FriendConnectionStatus } from "@pluralscape/types";
import type { BucketVisibilityScope } from "@pluralscape/types";
import type { AuthKeyType } from "@pluralscape/types";
import type { DeviceTransferStatus } from "@pluralscape/types";
import type { SyncOperation } from "@pluralscape/types";
import type { SyncResolution } from "@pluralscape/types";

export const COMPLETENESS_LEVELS = [
  "fragment",
  "demi-member",
  "full",
] as const satisfies readonly CompletenessLevel[];
export const FRONTING_TYPES = [
  "fronting",
  "co-conscious",
] as const satisfies readonly FrontingType[];
export const RELATIONSHIP_TYPES = [
  "split-from",
  "fused-from",
  "sibling",
  "partner",
  "parent-child",
  "protector-of",
  "caretaker-of",
  "gatekeeper-of",
  "source",
  "custom",
] as const satisfies readonly RelationshipType[];
export const LAYER_ACCESS_TYPES = [
  "open",
  "gatekept",
] as const satisfies readonly LayerAccessType[];
export const FRIEND_CONNECTION_STATUSES = [
  "pending",
  "accepted",
  "blocked",
  "removed",
] as const satisfies readonly FriendConnectionStatus[];
export const BUCKET_VISIBILITY_SCOPES = [
  "members",
  "custom-fields",
  "fronting-status",
  "custom-fronts",
  "notes",
  "chat",
  "journal-entries",
  "member-photos",
  "groups",
] as const satisfies readonly BucketVisibilityScope[];
export const AUTH_KEY_TYPES = ["encryption", "signing"] as const satisfies readonly AuthKeyType[];
export const DEVICE_TRANSFER_STATUSES = [
  "pending",
  "approved",
  "expired",
] as const satisfies readonly DeviceTransferStatus[];
export const SYNC_OPERATIONS = [
  "create",
  "update",
  "delete",
] as const satisfies readonly SyncOperation[];
export const SYNC_RESOLUTIONS = [
  "local",
  "remote",
  "merged",
] as const satisfies readonly SyncResolution[];
