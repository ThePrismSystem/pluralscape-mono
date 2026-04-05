/**
 * Row transform functions for local SQLite reads.
 *
 * Each transform accepts a raw `Record<string, unknown>` SQLite row and
 * returns a strongly-typed domain object. Guarded primitive helpers validate
 * every field at runtime and throw `RowTransformError` with table/field/rowId
 * context on type mismatches, making corrupt rows debuggable.
 *
 * Conventions:
 * - INTEGER columns storing booleans (0/1) are converted to `boolean`.
 * - TEXT columns storing JSON-serialized arrays or objects are parsed.
 * - Timestamps (INTEGER, Unix ms) are validated as numbers and branded.
 * - `archivedAt` is not stored in SQLite; always `null` in local rows.
 * - `version` is not stored in SQLite; always `0` in local rows.
 *
 * For E2E-encrypted entities the local SQLite holds the **plaintext** fields
 * (materialized from the CRDT document), not an `encryptedData` blob. The
 * returned types therefore omit `encryptedData` and include the plain fields
 * directly, matching the decrypted domain shape.
 */

import type {
  FieldDefinitionDecrypted,
  FieldValueDecrypted,
} from "@pluralscape/data/transforms/custom-field";
import type { FrontingReportRaw } from "@pluralscape/data/transforms/fronting-report";
import type { GroupDecrypted } from "@pluralscape/data/transforms/group";
import type { LifecycleEventWithArchive } from "@pluralscape/data/transforms/lifecycle-event";
import type { NoteDecrypted } from "@pluralscape/data/transforms/note";
import type {
  AcknowledgementRequest,
  Archived,
  ArchivedAcknowledgementRequest,
  ArchivedBoardMessage,
  ArchivedChannel,
  ArchivedChatMessage,
  ArchivedCheckInRecord,
  ArchivedCustomFront,
  ArchivedFriendCode,
  ArchivedFriendConnection,
  ArchivedFrontingComment,
  ArchivedFrontingSession,
  ArchivedInnerWorldEntity,
  ArchivedInnerWorldRegion,
  ArchivedJournalEntry,
  ArchivedMember,
  ArchivedMemberPhoto,
  ArchivedPoll,
  ArchivedPrivacyBucket,
  ArchivedRelationship,
  ArchivedSystemStructureEntity,
  ArchivedSystemStructureEntityType,
  ArchivedTimerConfig,
  ArchivedWikiPage,
  BoardMessage,
  Channel,
  ChatMessage,
  CheckInRecord,
  CustomFront,
  EntityReference,
  FieldValueUnion,
  FriendCode,
  FriendConnection,
  FriendVisibilitySettings,
  FrontingComment,
  FrontingSession,
  InnerWorldEntity,
  InnerWorldRegion,
  JournalEntry,
  LifecycleEvent,
  Member,
  MemberId,
  MemberPhoto,
  NoteAuthorEntityType,
  Poll,
  PrivacyBucket,
  Relationship,
  SystemId,
  SystemSettings,
  SystemStructureEntity,
  SystemStructureEntityAssociation,
  SystemStructureEntityLink,
  SystemStructureEntityMemberLink,
  SystemStructureEntityId,
  SystemStructureEntityType,
  TimerConfig,
  UnixMillis,
  WikiPage,
} from "@pluralscape/types";
// ── Primitive helpers ────────────────────────────────────────────────────────

/** Error thrown when a SQLite row field fails a runtime type guard. */
export class RowTransformError extends Error {
  readonly table: string;
  readonly field: string;
  readonly rowId: string | null;

  constructor(table: string, field: string, rowId: string | null, message: string) {
    super(`${table}.${field}${rowId !== null ? " (row " + rowId + ")" : ""}: ${message}`);
    this.name = "RowTransformError";
    this.table = table;
    this.field = field;
    this.rowId = rowId;
  }
}

/** Coerce a 0/1 INTEGER column to boolean. */
function intToBool(v: unknown): boolean {
  return v === 1 || v === true;
}

/**
 * Coerce a 0/1 INTEGER column to boolean, fail-closed for privacy fields.
 * Returns `true` when value is null or undefined (maximum restriction).
 */
export function intToBoolFailClosed(v: unknown): boolean {
  if (v === null || v === undefined) return true;
  return intToBool(v);
}

/**
 * Parse a JSON-serialized TEXT column. Returns `null` for null/undefined.
 * Non-strings pass through. Throws `RowTransformError` for malformed JSON.
 */
export function parseJsonSafe(
  v: unknown,
  table: string,
  field: string,
  rowId?: string | null,
): unknown {
  if (v === null || v === undefined) return null;
  if (typeof v !== "string") return v;
  try {
    return JSON.parse(v) as unknown;
  } catch {
    const truncated = v.length > 80 ? v.slice(0, 80) + "…" : v;
    throw new RowTransformError(table, field, rowId ?? null, `invalid JSON: ${truncated}`);
  }
}

/**
 * Parse a JSON-serialized TEXT column that is guaranteed non-null in the schema.
 * Non-strings pass through. Throws `RowTransformError` for malformed JSON.
 */
function parseJsonRequired(
  v: unknown,
  table: string,
  field: string,
  rowId?: string | null,
): unknown {
  if (typeof v !== "string") return v;
  try {
    return JSON.parse(v) as unknown;
  } catch {
    const truncated = v.length > 80 ? v.slice(0, 80) + "…" : v;
    throw new RowTransformError(table, field, rowId ?? null, `invalid JSON: ${truncated}`);
  }
}

/** Parse a JSON-serialized TEXT column as a string array. */
function parseStringArray(
  v: unknown,
  table: string,
  field: string,
  rowId?: string | null,
): readonly string[] {
  return parseJsonRequired(v, table, field, rowId) as readonly string[];
}

/** Parse a nullable JSON-serialized TEXT column as a string array. */
function parseStringArrayOrNull(
  v: unknown,
  table: string,
  field: string,
  rowId?: string | null,
): readonly string[] | null {
  return parseJsonSafe(v, table, field, rowId) as readonly string[] | null;
}

/**
 * Validate and cast to `UnixMillis`. Throws `RowTransformError` if the value
 * is not a number.
 */
export function guardedToMs(
  v: unknown,
  table: string,
  field: string,
  rowId?: string | null,
): UnixMillis {
  if (typeof v !== "number") {
    throw new RowTransformError(table, field, rowId ?? null, `expected number, got ${typeof v}`);
  }
  return v as UnixMillis;
}

/** Cast to `UnixMillis` or null. */
function toMsOrNull(
  v: unknown,
  table: string,
  field: string,
  rowId?: string | null,
): UnixMillis | null {
  if (v === null || v === undefined) return null;
  return guardedToMs(v, table, field, rowId);
}

/** Validate and cast to `string`. Throws `RowTransformError` if not a string. */
export function guardedStr(
  v: unknown,
  table: string,
  field: string,
  rowId?: string | null,
): string {
  if (typeof v !== "string") {
    throw new RowTransformError(table, field, rowId ?? null, `expected string, got ${typeof v}`);
  }
  return v;
}

/** Cast to string or null. */
function strOrNull(v: unknown, table: string, field: string, rowId?: string | null): string | null {
  if (v === null || v === undefined) return null;
  return guardedStr(v, table, field, rowId);
}

/** Validate and cast to `number`. Throws `RowTransformError` if not a number. */
export function guardedNum(
  v: unknown,
  table: string,
  field: string,
  rowId?: string | null,
): number {
  if (typeof v !== "number") {
    throw new RowTransformError(table, field, rowId ?? null, `expected number, got ${typeof v}`);
  }
  return v;
}

/** Cast to number or null. */
function numOrNull(v: unknown, table: string, field: string, rowId?: string | null): number | null {
  if (v === null || v === undefined) return null;
  return guardedNum(v, table, field, rowId);
}

// ── ID extractor ─────────────────────────────────────────────────────────────

/** Extract the row's primary key as a string for error context. */
function rid(row: Record<string, unknown>): string | null {
  const v = row["id"];
  return typeof v === "string" ? v : null;
}

// ── Archived wrapping helpers ─────────────────────────────────────────────────

/**
 * Wrap a domain object as Archived<T> using the row's updated_at as
 * archivedAt proxy. Only call when the row's `archived` column is 1.
 */
function wrapArchived<T extends { readonly archived: false }>(
  base: T,
  archivedAt: UnixMillis,
): Archived<T> {
  // Object.assign overwrites `archived: false` with `archived: true` without
  // needing a destructure (which would produce an unused-var lint error).
  return Object.assign({}, base, { archived: true as const, archivedAt }) as Archived<T>;
}

// ── Transform functions ──────────────────────────────────────────────────────

// ── system-core ──────────────────────────────────────────────────────────────

export function rowToSystemSettings(row: Record<string, unknown>): SystemSettings {
  const id = rid(row);
  return {
    id: guardedStr(row["id"], "system_settings", "id", id) as SystemSettings["id"],
    systemId: guardedStr(
      row["system_id"],
      "system_settings",
      "system_id",
      id,
    ) as SystemSettings["systemId"],
    theme: guardedStr(row["theme"], "system_settings", "theme", id) as SystemSettings["theme"],
    fontScale: guardedNum(row["font_scale"], "system_settings", "font_scale", id),
    locale: strOrNull(row["locale"], "system_settings", "locale", id) as SystemSettings["locale"],
    defaultBucketId: strOrNull(
      row["default_bucket_id"],
      "system_settings",
      "default_bucket_id",
      id,
    ) as SystemSettings["defaultBucketId"],
    appLock: parseJsonRequired(
      row["app_lock"],
      "system_settings",
      "app_lock",
      id,
    ) as SystemSettings["appLock"],
    notifications: parseJsonRequired(
      row["notifications"],
      "system_settings",
      "notifications",
      id,
    ) as SystemSettings["notifications"],
    syncPreferences: parseJsonRequired(
      row["sync_preferences"],
      "system_settings",
      "sync_preferences",
      id,
    ) as SystemSettings["syncPreferences"],
    privacyDefaults: parseJsonRequired(
      row["privacy_defaults"],
      "system_settings",
      "privacy_defaults",
      id,
    ) as SystemSettings["privacyDefaults"],
    littlesSafeMode: parseJsonRequired(
      row["littles_safe_mode"],
      "system_settings",
      "littles_safe_mode",
      id,
    ) as SystemSettings["littlesSafeMode"],
    nomenclature: parseJsonRequired(
      row["nomenclature"],
      "system_settings",
      "nomenclature",
      id,
    ) as SystemSettings["nomenclature"],
    saturationLevelsEnabled: intToBool(row["saturation_levels_enabled"]),
    autoCaptureFrontingOnJournal: intToBool(row["auto_capture_fronting_on_journal"]),
    snapshotSchedule: parseJsonRequired(
      row["snapshot_schedule"],
      "system_settings",
      "snapshot_schedule",
      id,
    ) as SystemSettings["snapshotSchedule"],
    onboardingComplete: intToBool(row["onboarding_complete"]),
    createdAt: guardedToMs(row["created_at"], "system_settings", "created_at", id),
    updatedAt: guardedToMs(row["updated_at"], "system_settings", "updated_at", id),
    version: 0,
  };
}

export function rowToMember(row: Record<string, unknown>): Member | ArchivedMember {
  const id = rid(row);
  const archived = intToBool(row["archived"]);
  const updatedAt = guardedToMs(row["updated_at"], "members", "updated_at", id);
  const base: Member = {
    id: guardedStr(row["id"], "members", "id", id) as Member["id"],
    systemId: guardedStr(row["system_id"], "members", "system_id", id) as Member["systemId"],
    name: guardedStr(row["name"], "members", "name", id),
    pronouns: parseStringArray(row["pronouns"], "members", "pronouns", id),
    description: strOrNull(row["description"], "members", "description", id),
    avatarSource: parseJsonSafe(
      row["avatar_source"],
      "members",
      "avatar_source",
      id,
    ) as Member["avatarSource"],
    colors: parseStringArray(row["colors"], "members", "colors", id) as Member["colors"],
    saturationLevel: parseJsonRequired(
      row["saturation_level"],
      "members",
      "saturation_level",
      id,
    ) as Member["saturationLevel"],
    tags: parseJsonRequired(row["tags"], "members", "tags", id) as Member["tags"],
    suppressFriendFrontNotification: intToBoolFailClosed(row["suppress_friend_front_notification"]),
    boardMessageNotificationOnFront: intToBoolFailClosed(
      row["board_message_notification_on_front"],
    ),
    archived: false,
    createdAt: guardedToMs(row["created_at"], "members", "created_at", id),
    updatedAt,
    version: 0,
  };
  return archived ? wrapArchived(base, updatedAt) : base;
}

export function rowToMemberPhoto(row: Record<string, unknown>): MemberPhoto | ArchivedMemberPhoto {
  const id = rid(row);
  const archived = intToBool(row["archived"]);
  const base: MemberPhoto = {
    id: guardedStr(row["id"], "member_photos", "id", id) as MemberPhoto["id"],
    memberId: guardedStr(
      row["member_id"],
      "member_photos",
      "member_id",
      id,
    ) as MemberPhoto["memberId"],
    imageSource: parseJsonSafe(
      row["image_source"],
      "member_photos",
      "image_source",
      id,
    ) as MemberPhoto["imageSource"],
    sortOrder: guardedNum(row["sort_order"], "member_photos", "sort_order", id),
    caption: strOrNull(row["caption"], "member_photos", "caption", id),
    archived: false,
  };
  if (archived) {
    // MemberPhoto has no updatedAt; use createdAt as proxy
    const createdAt = guardedToMs(row["created_at"], "member_photos", "created_at", id);
    return wrapArchived(base, createdAt);
  }
  return base;
}

export function rowToGroup(row: Record<string, unknown>): GroupDecrypted {
  const id = rid(row);
  const archived = intToBool(row["archived"]);
  const updatedAt = guardedToMs(row["updated_at"], "groups", "updated_at", id);
  return {
    id: guardedStr(row["id"], "groups", "id", id) as GroupDecrypted["id"],
    systemId: guardedStr(row["system_id"], "groups", "system_id", id) as GroupDecrypted["systemId"],
    name: guardedStr(row["name"], "groups", "name", id),
    description: strOrNull(row["description"], "groups", "description", id),
    parentGroupId: strOrNull(
      row["parent_group_id"],
      "groups",
      "parent_group_id",
      id,
    ) as GroupDecrypted["parentGroupId"],
    imageSource: parseJsonSafe(
      row["image_source"],
      "groups",
      "image_source",
      id,
    ) as GroupDecrypted["imageSource"],
    color: strOrNull(row["color"], "groups", "color", id) as GroupDecrypted["color"],
    emoji: strOrNull(row["emoji"], "groups", "emoji", id),
    sortOrder: guardedNum(row["sort_order"], "groups", "sort_order", id),
    archived,
    archivedAt: archived ? updatedAt : null,
    createdAt: guardedToMs(row["created_at"], "groups", "created_at", id),
    updatedAt,
    version: 0,
  };
}

export function rowToStructureEntityType(
  row: Record<string, unknown>,
): SystemStructureEntityType | ArchivedSystemStructureEntityType {
  const id = rid(row);
  const archived = intToBool(row["archived"]);
  const updatedAt = guardedToMs(
    row["updated_at"],
    "system_structure_entity_types",
    "updated_at",
    id,
  );
  const base: SystemStructureEntityType = {
    id: guardedStr(
      row["id"],
      "system_structure_entity_types",
      "id",
      id,
    ) as SystemStructureEntityType["id"],
    systemId: guardedStr(
      row["system_id"],
      "system_structure_entity_types",
      "system_id",
      id,
    ) as SystemStructureEntityType["systemId"],
    name: guardedStr(row["name"], "system_structure_entity_types", "name", id),
    description: strOrNull(row["description"], "system_structure_entity_types", "description", id),
    color: strOrNull(
      row["color"],
      "system_structure_entity_types",
      "color",
      id,
    ) as SystemStructureEntityType["color"],
    imageSource: parseJsonSafe(
      row["image_source"],
      "system_structure_entity_types",
      "image_source",
      id,
    ) as SystemStructureEntityType["imageSource"],
    emoji: strOrNull(row["emoji"], "system_structure_entity_types", "emoji", id),
    sortOrder: guardedNum(row["sort_order"], "system_structure_entity_types", "sort_order", id),
    archived: false,
    createdAt: guardedToMs(row["created_at"], "system_structure_entity_types", "created_at", id),
    updatedAt,
    version: 0,
  };
  return archived ? wrapArchived(base, updatedAt) : base;
}

export function rowToStructureEntity(
  row: Record<string, unknown>,
): SystemStructureEntity | ArchivedSystemStructureEntity {
  const id = rid(row);
  const archived = intToBool(row["archived"]);
  const updatedAt = guardedToMs(row["updated_at"], "system_structure_entities", "updated_at", id);
  const base: SystemStructureEntity = {
    id: guardedStr(row["id"], "system_structure_entities", "id", id) as SystemStructureEntity["id"],
    systemId: guardedStr(
      row["system_id"],
      "system_structure_entities",
      "system_id",
      id,
    ) as SystemStructureEntity["systemId"],
    entityTypeId: guardedStr(
      row["entity_type_id"],
      "system_structure_entities",
      "entity_type_id",
      id,
    ) as SystemStructureEntity["entityTypeId"],
    name: guardedStr(row["name"], "system_structure_entities", "name", id),
    description: strOrNull(row["description"], "system_structure_entities", "description", id),
    color: strOrNull(
      row["color"],
      "system_structure_entities",
      "color",
      id,
    ) as SystemStructureEntity["color"],
    imageSource: parseJsonSafe(
      row["image_source"],
      "system_structure_entities",
      "image_source",
      id,
    ) as SystemStructureEntity["imageSource"],
    emoji: strOrNull(row["emoji"], "system_structure_entities", "emoji", id),
    sortOrder: guardedNum(row["sort_order"], "system_structure_entities", "sort_order", id),
    archived: false,
    createdAt: guardedToMs(row["created_at"], "system_structure_entities", "created_at", id),
    updatedAt,
    version: 0,
  };
  return archived ? wrapArchived(base, updatedAt) : base;
}

export function rowToStructureEntityLink(row: Record<string, unknown>): SystemStructureEntityLink {
  const id = rid(row);
  return {
    id: guardedStr(
      row["id"],
      "system_structure_entity_links",
      "id",
      id,
    ) as SystemStructureEntityLink["id"],
    systemId: guardedStr(
      row["system_id"],
      "system_structure_entity_links",
      "system_id",
      id,
    ) as SystemStructureEntityLink["systemId"],
    entityId: guardedStr(
      row["entity_id"],
      "system_structure_entity_links",
      "entity_id",
      id,
    ) as SystemStructureEntityLink["entityId"],
    parentEntityId: strOrNull(
      row["parent_entity_id"],
      "system_structure_entity_links",
      "parent_entity_id",
      id,
    ) as SystemStructureEntityLink["parentEntityId"],
    sortOrder: guardedNum(row["sort_order"], "system_structure_entity_links", "sort_order", id),
    createdAt: guardedToMs(row["created_at"], "system_structure_entity_links", "created_at", id),
  };
}

export function rowToStructureEntityMemberLink(
  row: Record<string, unknown>,
): SystemStructureEntityMemberLink {
  const id = rid(row);
  return {
    id: guardedStr(
      row["id"],
      "system_structure_entity_member_links",
      "id",
      id,
    ) as SystemStructureEntityMemberLink["id"],
    systemId: guardedStr(
      row["system_id"],
      "system_structure_entity_member_links",
      "system_id",
      id,
    ) as SystemStructureEntityMemberLink["systemId"],
    memberId: guardedStr(
      row["member_id"],
      "system_structure_entity_member_links",
      "member_id",
      id,
    ) as SystemStructureEntityMemberLink["memberId"],
    parentEntityId: strOrNull(
      row["parent_entity_id"],
      "system_structure_entity_member_links",
      "parent_entity_id",
      id,
    ) as SystemStructureEntityMemberLink["parentEntityId"],
    sortOrder: guardedNum(
      row["sort_order"],
      "system_structure_entity_member_links",
      "sort_order",
      id,
    ),
    createdAt: guardedToMs(
      row["created_at"],
      "system_structure_entity_member_links",
      "created_at",
      id,
    ),
  };
}

export function rowToStructureEntityAssociation(
  row: Record<string, unknown>,
): SystemStructureEntityAssociation {
  const id = rid(row);
  return {
    id: guardedStr(
      row["id"],
      "system_structure_entity_associations",
      "id",
      id,
    ) as SystemStructureEntityAssociation["id"],
    systemId: guardedStr(
      row["system_id"],
      "system_structure_entity_associations",
      "system_id",
      id,
    ) as SystemStructureEntityAssociation["systemId"],
    sourceEntityId: guardedStr(
      row["source_entity_id"],
      "system_structure_entity_associations",
      "source_entity_id",
      id,
    ) as SystemStructureEntityAssociation["sourceEntityId"],
    targetEntityId: guardedStr(
      row["target_entity_id"],
      "system_structure_entity_associations",
      "target_entity_id",
      id,
    ) as SystemStructureEntityAssociation["targetEntityId"],
    createdAt: guardedToMs(
      row["created_at"],
      "system_structure_entity_associations",
      "created_at",
      id,
    ),
  };
}

export function rowToRelationship(
  row: Record<string, unknown>,
): Relationship | ArchivedRelationship {
  const id = rid(row);
  const archived = intToBool(row["archived"]);
  const createdAt = guardedToMs(row["created_at"], "relationships", "created_at", id);
  const base: Relationship = {
    id: guardedStr(row["id"], "relationships", "id", id) as Relationship["id"],
    systemId: guardedStr(
      row["system_id"],
      "relationships",
      "system_id",
      id,
    ) as Relationship["systemId"],
    sourceMemberId: strOrNull(
      row["source_member_id"],
      "relationships",
      "source_member_id",
      id,
    ) as Relationship["sourceMemberId"],
    targetMemberId: strOrNull(
      row["target_member_id"],
      "relationships",
      "target_member_id",
      id,
    ) as Relationship["targetMemberId"],
    type: guardedStr(row["type"], "relationships", "type", id) as Relationship["type"],
    label: strOrNull(row["label"], "relationships", "label", id),
    bidirectional: intToBool(row["bidirectional"]),
    createdAt,
    archived: false,
  };
  return archived ? wrapArchived(base, createdAt) : base;
}

export function rowToCustomFront(row: Record<string, unknown>): CustomFront | ArchivedCustomFront {
  const id = rid(row);
  const archived = intToBool(row["archived"]);
  const updatedAt = guardedToMs(row["updated_at"], "custom_fronts", "updated_at", id);
  const base: CustomFront = {
    id: guardedStr(row["id"], "custom_fronts", "id", id) as CustomFront["id"],
    systemId: guardedStr(
      row["system_id"],
      "custom_fronts",
      "system_id",
      id,
    ) as CustomFront["systemId"],
    name: guardedStr(row["name"], "custom_fronts", "name", id),
    description: strOrNull(row["description"], "custom_fronts", "description", id),
    color: strOrNull(row["color"], "custom_fronts", "color", id) as CustomFront["color"],
    emoji: strOrNull(row["emoji"], "custom_fronts", "emoji", id),
    archived: false,
    createdAt: guardedToMs(row["created_at"], "custom_fronts", "created_at", id),
    updatedAt,
    version: 0,
  };
  return archived ? wrapArchived(base, updatedAt) : base;
}

export function rowToFieldDefinition(row: Record<string, unknown>): FieldDefinitionDecrypted {
  const id = rid(row);
  const archived = intToBool(row["archived"]);
  const updatedAt = guardedToMs(row["updated_at"], "field_definitions", "updated_at", id);
  return {
    id: guardedStr(row["id"], "field_definitions", "id", id) as FieldDefinitionDecrypted["id"],
    systemId: guardedStr(
      row["system_id"],
      "field_definitions",
      "system_id",
      id,
    ) as FieldDefinitionDecrypted["systemId"],
    name: guardedStr(row["name"], "field_definitions", "name", id),
    description: strOrNull(row["description"], "field_definitions", "description", id),
    fieldType: guardedStr(
      row["field_type"],
      "field_definitions",
      "field_type",
      id,
    ) as FieldDefinitionDecrypted["fieldType"],
    options: parseStringArrayOrNull(row["options"], "field_definitions", "options", id),
    required: intToBool(row["required"]),
    sortOrder: guardedNum(row["sort_order"], "field_definitions", "sort_order", id),
    archived,
    archivedAt: archived ? updatedAt : null,
    createdAt: guardedToMs(row["created_at"], "field_definitions", "created_at", id),
    updatedAt,
    version: 0,
  };
}

/**
 * The local `field_values` table stores the full `FieldValueUnion` as a
 * JSON-serialized string in the `value` column, and does not have a
 * `system_id` column. Pass the owning system's ID from the query context.
 */
export function rowToFieldValue(
  row: Record<string, unknown>,
  systemId: SystemId,
): FieldValueDecrypted {
  const id = rid(row);
  const valueUnion = parseJsonSafe(row["value"], "field_values", "value", id) as FieldValueUnion;
  return {
    id: guardedStr(row["id"], "field_values", "id", id) as FieldValueDecrypted["id"],
    fieldDefinitionId: guardedStr(
      row["field_definition_id"],
      "field_values",
      "field_definition_id",
      id,
    ) as FieldValueDecrypted["fieldDefinitionId"],
    memberId: strOrNull(
      row["member_id"],
      "field_values",
      "member_id",
      id,
    ) as FieldValueDecrypted["memberId"],
    structureEntityId: strOrNull(
      row["structure_entity_id"],
      "field_values",
      "structure_entity_id",
      id,
    ) as FieldValueDecrypted["structureEntityId"],
    groupId: strOrNull(
      row["group_id"],
      "field_values",
      "group_id",
      id,
    ) as FieldValueDecrypted["groupId"],
    systemId,
    fieldType: valueUnion.fieldType,
    value: valueUnion.value,
    createdAt: guardedToMs(row["created_at"], "field_values", "created_at", id),
    updatedAt: guardedToMs(row["updated_at"], "field_values", "updated_at", id),
    version: 0,
  } as FieldValueDecrypted;
}

export function rowToInnerWorldEntity(
  row: Record<string, unknown>,
): InnerWorldEntity | ArchivedInnerWorldEntity {
  const id = rid(row);
  const archived = intToBool(row["archived"]);
  const updatedAt = guardedToMs(row["updated_at"], "innerworld_entities", "updated_at", id);
  const entityType = guardedStr(
    row["entity_type"],
    "innerworld_entities",
    "entity_type",
    id,
  ) as InnerWorldEntity["entityType"];
  const baseCommon = {
    id: guardedStr(row["id"], "innerworld_entities", "id", id) as InnerWorldEntity["id"],
    systemId: guardedStr(
      row["system_id"],
      "innerworld_entities",
      "system_id",
      id,
    ) as InnerWorldEntity["systemId"],
    positionX: guardedNum(row["position_x"], "innerworld_entities", "position_x", id),
    positionY: guardedNum(row["position_y"], "innerworld_entities", "position_y", id),
    visual: parseJsonRequired(
      row["visual"],
      "innerworld_entities",
      "visual",
      id,
    ) as InnerWorldEntity["visual"],
    regionId: strOrNull(
      row["region_id"],
      "innerworld_entities",
      "region_id",
      id,
    ) as InnerWorldEntity["regionId"],
    archived: false as const,
    createdAt: guardedToMs(row["created_at"], "innerworld_entities", "created_at", id),
    updatedAt,
    version: 0,
  };

  if (entityType === "member") {
    const memberEntity = {
      ...baseCommon,
      entityType: "member" as const,
      linkedMemberId: guardedStr(
        row["linked_member_id"],
        "innerworld_entities",
        "linked_member_id",
        id,
      ) as MemberId,
    };
    return archived ? wrapArchived(memberEntity, updatedAt) : memberEntity;
  }
  if (entityType === "landmark") {
    const landmarkEntity = {
      ...baseCommon,
      entityType: "landmark" as const,
      name: strOrNull(row["name"], "innerworld_entities", "name", id) ?? "",
      description: strOrNull(row["description"], "innerworld_entities", "description", id),
    };
    return archived ? wrapArchived(landmarkEntity, updatedAt) : landmarkEntity;
  }
  const structureEntity = {
    ...baseCommon,
    entityType: "structure-entity" as const,
    linkedStructureEntityId: guardedStr(
      row["linked_structure_entity_id"],
      "innerworld_entities",
      "linked_structure_entity_id",
      id,
    ) as SystemStructureEntityId,
  };
  return archived ? wrapArchived(structureEntity, updatedAt) : structureEntity;
}

export function rowToInnerWorldRegion(
  row: Record<string, unknown>,
): InnerWorldRegion | ArchivedInnerWorldRegion {
  const id = rid(row);
  const archived = intToBool(row["archived"]);
  const updatedAt = guardedToMs(row["updated_at"], "innerworld_regions", "updated_at", id);
  const base: InnerWorldRegion = {
    id: guardedStr(row["id"], "innerworld_regions", "id", id) as InnerWorldRegion["id"],
    systemId: guardedStr(
      row["system_id"],
      "innerworld_regions",
      "system_id",
      id,
    ) as InnerWorldRegion["systemId"],
    name: guardedStr(row["name"], "innerworld_regions", "name", id),
    description: strOrNull(row["description"], "innerworld_regions", "description", id),
    parentRegionId: strOrNull(
      row["parent_region_id"],
      "innerworld_regions",
      "parent_region_id",
      id,
    ) as InnerWorldRegion["parentRegionId"],
    visual: parseJsonRequired(
      row["visual"],
      "innerworld_regions",
      "visual",
      id,
    ) as InnerWorldRegion["visual"],
    boundaryData: parseJsonRequired(
      row["boundary_data"],
      "innerworld_regions",
      "boundary_data",
      id,
    ) as InnerWorldRegion["boundaryData"],
    accessType: guardedStr(
      row["access_type"],
      "innerworld_regions",
      "access_type",
      id,
    ) as InnerWorldRegion["accessType"],
    gatekeeperMemberIds: parseStringArray(
      row["gatekeeper_member_ids"],
      "innerworld_regions",
      "gatekeeper_member_ids",
      id,
    ) as InnerWorldRegion["gatekeeperMemberIds"],
    archived: false,
    createdAt: guardedToMs(row["created_at"], "innerworld_regions", "created_at", id),
    updatedAt,
    version: 0,
  };
  return archived ? wrapArchived(base, updatedAt) : base;
}

export function rowToTimer(row: Record<string, unknown>): TimerConfig | ArchivedTimerConfig {
  const id = rid(row);
  const archived = intToBool(row["archived"]);
  const updatedAt = guardedToMs(row["updated_at"], "timer_configs", "updated_at", id);
  const wakingHoursOnly =
    row["waking_hours_only"] === null || row["waking_hours_only"] === undefined
      ? null
      : intToBool(row["waking_hours_only"]);
  const base: TimerConfig = {
    id: guardedStr(row["id"], "timer_configs", "id", id) as TimerConfig["id"],
    systemId: guardedStr(
      row["system_id"],
      "timer_configs",
      "system_id",
      id,
    ) as TimerConfig["systemId"],
    intervalMinutes: numOrNull(row["interval_minutes"], "timer_configs", "interval_minutes", id),
    wakingHoursOnly,
    wakingStart: strOrNull(row["waking_start"], "timer_configs", "waking_start", id),
    wakingEnd: strOrNull(row["waking_end"], "timer_configs", "waking_end", id),
    promptText: guardedStr(row["prompt_text"], "timer_configs", "prompt_text", id),
    enabled: intToBool(row["enabled"]),
    archived: false,
    createdAt: guardedToMs(row["created_at"], "timer_configs", "created_at", id),
    updatedAt,
    version: 0,
  };
  return archived ? wrapArchived(base, updatedAt) : base;
}

/**
 * Type assertion: the CRDT materializer validated the LifecycleEvent payload
 * shape at write time, so the assembled object is a valid discriminated union
 * member. TS cannot verify this statically across a generic payload spread.
 */
function assertLifecycleEvent(_v: unknown): asserts _v is LifecycleEvent {
  // Validated by CRDT materializer at write time
}

export function rowToLifecycleEvent(row: Record<string, unknown>): LifecycleEventWithArchive {
  const id = rid(row);
  const archived = intToBool(row["archived"]);
  const eventType = guardedStr(
    row["event_type"],
    "lifecycle_events",
    "event_type",
    id,
  ) as LifecycleEvent["eventType"];
  const payload = parseJsonRequired(row["payload"], "lifecycle_events", "payload", id) as Record<
    string,
    unknown
  >;
  const recordedAt = guardedToMs(row["recorded_at"], "lifecycle_events", "recorded_at", id);
  const base = {
    id: guardedStr(row["id"], "lifecycle_events", "id", id) as LifecycleEvent["id"],
    systemId: guardedStr(
      row["system_id"],
      "lifecycle_events",
      "system_id",
      id,
    ) as LifecycleEvent["systemId"],
    occurredAt: guardedToMs(row["occurred_at"], "lifecycle_events", "occurred_at", id),
    recordedAt,
    notes: strOrNull(row["notes"], "lifecycle_events", "notes", id),
  };
  const assembled = { ...base, eventType, ...payload };
  assertLifecycleEvent(assembled);
  if (archived) {
    return { ...assembled, archived: true as const, archivedAt: recordedAt };
  }
  return { ...assembled, archived: false as const };
}

// ── fronting document ────────────────────────────────────────────────────────

export function rowToFrontingSession(
  row: Record<string, unknown>,
): FrontingSession | ArchivedFrontingSession {
  const id = rid(row);
  const archived = intToBool(row["archived"]);
  const updatedAt = guardedToMs(row["updated_at"], "fronting_sessions", "updated_at", id);
  const endTime = toMsOrNull(row["end_time"], "fronting_sessions", "end_time", id);
  const baseCommon = {
    id: guardedStr(row["id"], "fronting_sessions", "id", id) as FrontingSession["id"],
    systemId: guardedStr(
      row["system_id"],
      "fronting_sessions",
      "system_id",
      id,
    ) as FrontingSession["systemId"],
    memberId: strOrNull(
      row["member_id"],
      "fronting_sessions",
      "member_id",
      id,
    ) as FrontingSession["memberId"],
    startTime: guardedToMs(row["start_time"], "fronting_sessions", "start_time", id),
    comment: strOrNull(row["comment"], "fronting_sessions", "comment", id),
    customFrontId: strOrNull(
      row["custom_front_id"],
      "fronting_sessions",
      "custom_front_id",
      id,
    ) as FrontingSession["customFrontId"],
    structureEntityId: strOrNull(
      row["structure_entity_id"],
      "fronting_sessions",
      "structure_entity_id",
      id,
    ) as FrontingSession["structureEntityId"],
    positionality: strOrNull(row["positionality"], "fronting_sessions", "positionality", id),
    outtrigger: strOrNull(row["outtrigger"], "fronting_sessions", "outtrigger", id),
    outtriggerSentiment: strOrNull(
      row["outtrigger_sentiment"],
      "fronting_sessions",
      "outtrigger_sentiment",
      id,
    ) as FrontingSession["outtriggerSentiment"],
    archived: false as const,
    createdAt: guardedToMs(row["created_at"], "fronting_sessions", "created_at", id),
    updatedAt,
    version: 0,
  };
  const base: FrontingSession =
    endTime === null ? { ...baseCommon, endTime: null } : { ...baseCommon, endTime };
  return archived ? wrapArchived(base, updatedAt) : base;
}

export function rowToFrontingComment(
  row: Record<string, unknown>,
): FrontingComment | ArchivedFrontingComment {
  const id = rid(row);
  const archived = intToBool(row["archived"]);
  const updatedAt = guardedToMs(row["updated_at"], "fronting_comments", "updated_at", id);
  const base: FrontingComment = {
    id: guardedStr(row["id"], "fronting_comments", "id", id) as FrontingComment["id"],
    frontingSessionId: guardedStr(
      row["fronting_session_id"],
      "fronting_comments",
      "fronting_session_id",
      id,
    ) as FrontingComment["frontingSessionId"],
    systemId: guardedStr(
      row["system_id"],
      "fronting_comments",
      "system_id",
      id,
    ) as FrontingComment["systemId"],
    memberId: strOrNull(
      row["member_id"],
      "fronting_comments",
      "member_id",
      id,
    ) as FrontingComment["memberId"],
    customFrontId: strOrNull(
      row["custom_front_id"],
      "fronting_comments",
      "custom_front_id",
      id,
    ) as FrontingComment["customFrontId"],
    structureEntityId: strOrNull(
      row["structure_entity_id"],
      "fronting_comments",
      "structure_entity_id",
      id,
    ) as FrontingComment["structureEntityId"],
    content: guardedStr(row["content"], "fronting_comments", "content", id),
    archived: false,
    createdAt: guardedToMs(row["created_at"], "fronting_comments", "created_at", id),
    updatedAt,
    version: 0,
  };
  return archived ? wrapArchived(base, updatedAt) : base;
}

export function rowToCheckInRecord(
  row: Record<string, unknown>,
): CheckInRecord | ArchivedCheckInRecord {
  const id = rid(row);
  const archived = intToBool(row["archived"]);
  const archivedAt = toMsOrNull(row["archived_at"], "check_in_records", "archived_at", id);
  const base: CheckInRecord = {
    id: guardedStr(row["id"], "check_in_records", "id", id) as CheckInRecord["id"],
    timerConfigId: guardedStr(
      row["timer_config_id"],
      "check_in_records",
      "timer_config_id",
      id,
    ) as CheckInRecord["timerConfigId"],
    systemId: guardedStr(
      row["system_id"],
      "check_in_records",
      "system_id",
      id,
    ) as CheckInRecord["systemId"],
    scheduledAt: guardedToMs(row["scheduled_at"], "check_in_records", "scheduled_at", id),
    respondedByMemberId: strOrNull(
      row["responded_by_member_id"],
      "check_in_records",
      "responded_by_member_id",
      id,
    ) as CheckInRecord["respondedByMemberId"],
    respondedAt: toMsOrNull(row["responded_at"], "check_in_records", "responded_at", id),
    dismissed: intToBool(row["dismissed"]),
    archived: false,
    archivedAt,
  };
  if (archived) {
    const updatedAt = guardedToMs(row["updated_at"], "check_in_records", "updated_at", id);
    return wrapArchived(base, archivedAt ?? updatedAt);
  }
  return base;
}

export function rowToFrontingReport(row: Record<string, unknown>): FrontingReportRaw {
  // FrontingReport is stored encrypted in SQLite; the row holds the wire shape
  // (encryptedData blob) rather than the decrypted domain fields.
  const id = rid(row);
  return {
    id: guardedStr(row["id"], "fronting_reports", "id", id) as FrontingReportRaw["id"],
    systemId: guardedStr(
      row["system_id"],
      "fronting_reports",
      "system_id",
      id,
    ) as FrontingReportRaw["systemId"],
    encryptedData: guardedStr(row["encrypted_data"], "fronting_reports", "encrypted_data", id),
    format: guardedStr(
      row["format"],
      "fronting_reports",
      "format",
      id,
    ) as FrontingReportRaw["format"],
    generatedAt: guardedToMs(row["generated_at"], "fronting_reports", "generated_at", id),
    version: 0,
    archived: false,
    archivedAt: null,
  };
}

// ── chat document ────────────────────────────────────────────────────────────

export function rowToChannel(row: Record<string, unknown>): Channel | ArchivedChannel {
  const id = rid(row);
  const archived = intToBool(row["archived"]);
  const updatedAt = guardedToMs(row["updated_at"], "channels", "updated_at", id);
  const base: Channel = {
    id: guardedStr(row["id"], "channels", "id", id) as Channel["id"],
    systemId: guardedStr(row["system_id"], "channels", "system_id", id) as Channel["systemId"],
    name: guardedStr(row["name"], "channels", "name", id),
    type: guardedStr(row["type"], "channels", "type", id) as Channel["type"],
    parentId: strOrNull(row["parent_id"], "channels", "parent_id", id) as Channel["parentId"],
    sortOrder: guardedNum(row["sort_order"], "channels", "sort_order", id),
    archived: false,
    createdAt: guardedToMs(row["created_at"], "channels", "created_at", id),
    updatedAt,
    version: 0,
  };
  return archived ? wrapArchived(base, updatedAt) : base;
}

export function rowToMessage(row: Record<string, unknown>): ChatMessage | ArchivedChatMessage {
  const id = rid(row);
  const archived = intToBool(row["archived"]);
  // Mobile SQLite stores edited_at (timestamp), not edit_of (reference)
  const updatedAt =
    toMsOrNull(row["updated_at"], "messages", "updated_at", id) ??
    guardedToMs(row["created_at"], "messages", "created_at", id);
  const base: ChatMessage = {
    id: guardedStr(row["id"], "messages", "id", id) as ChatMessage["id"],
    channelId: guardedStr(
      row["channel_id"],
      "messages",
      "channel_id",
      id,
    ) as ChatMessage["channelId"],
    systemId: guardedStr(row["system_id"], "messages", "system_id", id) as ChatMessage["systemId"],
    senderId: guardedStr(row["sender_id"], "messages", "sender_id", id) as ChatMessage["senderId"],
    content: guardedStr(row["content"], "messages", "content", id),
    attachments: parseStringArray(
      row["attachments"],
      "messages",
      "attachments",
      id,
    ) as ChatMessage["attachments"],
    mentions: parseStringArray(
      row["mentions"],
      "messages",
      "mentions",
      id,
    ) as ChatMessage["mentions"],
    replyToId: strOrNull(
      row["reply_to_id"],
      "messages",
      "reply_to_id",
      id,
    ) as ChatMessage["replyToId"],
    timestamp: guardedToMs(row["timestamp"], "messages", "timestamp", id),
    editedAt: toMsOrNull(row["edited_at"], "messages", "edited_at", id),
    archived: false,
    createdAt: guardedToMs(row["created_at"], "messages", "created_at", id),
    updatedAt,
    version: 0,
  };
  return archived ? wrapArchived(base, updatedAt) : base;
}

export function rowToBoardMessage(
  row: Record<string, unknown>,
): BoardMessage | ArchivedBoardMessage {
  const id = rid(row);
  const archived = intToBool(row["archived"]);
  const updatedAt = guardedToMs(row["updated_at"], "board_messages", "updated_at", id);
  const base: BoardMessage = {
    id: guardedStr(row["id"], "board_messages", "id", id) as BoardMessage["id"],
    systemId: guardedStr(
      row["system_id"],
      "board_messages",
      "system_id",
      id,
    ) as BoardMessage["systemId"],
    senderId: guardedStr(
      row["sender_id"],
      "board_messages",
      "sender_id",
      id,
    ) as BoardMessage["senderId"],
    content: guardedStr(row["content"], "board_messages", "content", id),
    pinned: intToBool(row["pinned"]),
    sortOrder: guardedNum(row["sort_order"], "board_messages", "sort_order", id),
    archived: false,
    createdAt: guardedToMs(row["created_at"], "board_messages", "created_at", id),
    updatedAt,
    version: 0,
  };
  return archived ? wrapArchived(base, updatedAt) : base;
}

export function rowToPoll(row: Record<string, unknown>): Poll | ArchivedPoll {
  const id = rid(row);
  const archived = intToBool(row["archived"]);
  const updatedAt = guardedToMs(row["updated_at"], "polls", "updated_at", id);
  const base: Poll = {
    id: guardedStr(row["id"], "polls", "id", id) as Poll["id"],
    systemId: guardedStr(row["system_id"], "polls", "system_id", id) as Poll["systemId"],
    createdByMemberId: guardedStr(
      row["created_by_member_id"],
      "polls",
      "created_by_member_id",
      id,
    ) as Poll["createdByMemberId"],
    title: guardedStr(row["title"], "polls", "title", id),
    description: strOrNull(row["description"], "polls", "description", id),
    kind: guardedStr(row["kind"], "polls", "kind", id) as Poll["kind"],
    options: [] as Poll["options"],
    status: guardedStr(row["status"], "polls", "status", id) as Poll["status"],
    closedAt: toMsOrNull(row["closed_at"], "polls", "closed_at", id),
    endsAt: toMsOrNull(row["ends_at"], "polls", "ends_at", id),
    allowMultipleVotes: intToBool(row["allow_multiple_votes"]),
    maxVotesPerMember: guardedNum(row["max_votes_per_member"], "polls", "max_votes_per_member", id),
    allowAbstain: intToBool(row["allow_abstain"]),
    allowVeto: intToBool(row["allow_veto"]),
    archived: false,
    createdAt: guardedToMs(row["created_at"], "polls", "created_at", id),
    updatedAt,
    version: 0,
  };
  return archived ? wrapArchived(base, updatedAt) : base;
}

export function rowToAcknowledgement(
  row: Record<string, unknown>,
): AcknowledgementRequest | ArchivedAcknowledgementRequest {
  const id = rid(row);
  const archived = intToBool(row["archived"]);
  const updatedAt = guardedToMs(row["updated_at"], "acknowledgements", "updated_at", id);
  const base: AcknowledgementRequest = {
    id: guardedStr(row["id"], "acknowledgements", "id", id) as AcknowledgementRequest["id"],
    systemId: guardedStr(
      row["system_id"],
      "acknowledgements",
      "system_id",
      id,
    ) as AcknowledgementRequest["systemId"],
    createdByMemberId: guardedStr(
      row["created_by_member_id"],
      "acknowledgements",
      "created_by_member_id",
      id,
    ) as AcknowledgementRequest["createdByMemberId"],
    targetMemberId: guardedStr(
      row["target_member_id"],
      "acknowledgements",
      "target_member_id",
      id,
    ) as AcknowledgementRequest["targetMemberId"],
    message: guardedStr(row["message"], "acknowledgements", "message", id),
    confirmed: intToBool(row["confirmed"]),
    confirmedAt: toMsOrNull(row["confirmed_at"], "acknowledgements", "confirmed_at", id),
    archived: false,
    createdAt: guardedToMs(row["created_at"], "acknowledgements", "created_at", id),
    updatedAt,
    version: 0,
  };
  return archived ? wrapArchived(base, updatedAt) : base;
}

// ── journal document ─────────────────────────────────────────────────────────

export function rowToJournalEntry(
  row: Record<string, unknown>,
): JournalEntry | ArchivedJournalEntry {
  const id = rid(row);
  const archived = intToBool(row["archived"]);
  const updatedAt = guardedToMs(row["updated_at"], "journal_entries", "updated_at", id);
  // Mobile SQLite stores `author` as a plain member-ID string; reconstruct EntityReference.
  const authorRaw = strOrNull(row["author"], "journal_entries", "author", id);
  const author: EntityReference<"member" | "structure-entity"> | null =
    authorRaw !== null ? { entityType: "member", entityId: authorRaw } : null;
  const base: JournalEntry = {
    id: guardedStr(row["id"], "journal_entries", "id", id) as JournalEntry["id"],
    systemId: guardedStr(
      row["system_id"],
      "journal_entries",
      "system_id",
      id,
    ) as JournalEntry["systemId"],
    author,
    frontingSessionId: strOrNull(
      row["fronting_session_id"],
      "journal_entries",
      "fronting_session_id",
      id,
    ) as JournalEntry["frontingSessionId"],
    title: guardedStr(row["title"], "journal_entries", "title", id),
    blocks: parseJsonRequired(
      row["blocks"],
      "journal_entries",
      "blocks",
      id,
    ) as JournalEntry["blocks"],
    tags: parseStringArray(row["tags"], "journal_entries", "tags", id),
    linkedEntities: parseJsonRequired(
      row["linked_entities"],
      "journal_entries",
      "linked_entities",
      id,
    ) as JournalEntry["linkedEntities"],
    frontingSnapshots: parseJsonSafe(
      row["fronting_snapshots"],
      "journal_entries",
      "fronting_snapshots",
      id,
    ) as JournalEntry["frontingSnapshots"],
    archived: false,
    createdAt: guardedToMs(row["created_at"], "journal_entries", "created_at", id),
    updatedAt,
    version: 0,
  };
  return archived ? wrapArchived(base, updatedAt) : base;
}

export function rowToWikiPage(row: Record<string, unknown>): WikiPage | ArchivedWikiPage {
  const id = rid(row);
  const archived = intToBool(row["archived"]);
  const updatedAt = guardedToMs(row["updated_at"], "wiki_pages", "updated_at", id);
  const base: WikiPage = {
    id: guardedStr(row["id"], "wiki_pages", "id", id) as WikiPage["id"],
    systemId: guardedStr(row["system_id"], "wiki_pages", "system_id", id) as WikiPage["systemId"],
    title: guardedStr(row["title"], "wiki_pages", "title", id),
    slug: guardedStr(row["slug"], "wiki_pages", "slug", id),
    blocks: parseJsonRequired(row["blocks"], "wiki_pages", "blocks", id) as WikiPage["blocks"],
    linkedFromPages: parseStringArray(
      row["linked_from_pages"],
      "wiki_pages",
      "linked_from_pages",
      id,
    ) as WikiPage["linkedFromPages"],
    tags: parseStringArray(row["tags"], "wiki_pages", "tags", id),
    linkedEntities: parseJsonRequired(
      row["linked_entities"],
      "wiki_pages",
      "linked_entities",
      id,
    ) as WikiPage["linkedEntities"],
    archived: false,
    createdAt: guardedToMs(row["created_at"], "wiki_pages", "created_at", id),
    updatedAt,
    version: 0,
  };
  return archived ? wrapArchived(base, updatedAt) : base;
}

export function rowToNote(row: Record<string, unknown>): NoteDecrypted | Archived<NoteDecrypted> {
  const id = rid(row);
  const archived = intToBool(row["archived"]);
  const updatedAt = guardedToMs(row["updated_at"], "notes", "updated_at", id);
  const base: NoteDecrypted = {
    id: guardedStr(row["id"], "notes", "id", id) as NoteDecrypted["id"],
    systemId: guardedStr(row["system_id"], "notes", "system_id", id) as NoteDecrypted["systemId"],
    authorEntityType: strOrNull(
      row["author_entity_type"],
      "notes",
      "author_entity_type",
      id,
    ) as NoteAuthorEntityType | null,
    authorEntityId: strOrNull(row["author_entity_id"], "notes", "author_entity_id", id),
    title: guardedStr(row["title"], "notes", "title", id),
    content: guardedStr(row["content"], "notes", "content", id),
    backgroundColor: strOrNull(
      row["background_color"],
      "notes",
      "background_color",
      id,
    ) as NoteDecrypted["backgroundColor"],
    archived: false,
    version: 0,
    createdAt: guardedToMs(row["created_at"], "notes", "created_at", id),
    updatedAt,
  };
  return archived ? { ...base, archived: true as const, archivedAt: updatedAt } : base;
}

// ── privacy-config document ──────────────────────────────────────────────────

export function rowToPrivacyBucket(
  row: Record<string, unknown>,
): PrivacyBucket | ArchivedPrivacyBucket {
  const id = rid(row);
  const archived = intToBool(row["archived"]);
  const updatedAt = guardedToMs(row["updated_at"], "privacy_buckets", "updated_at", id);
  const base: PrivacyBucket = {
    id: guardedStr(row["id"], "privacy_buckets", "id", id) as PrivacyBucket["id"],
    systemId: guardedStr(
      row["system_id"],
      "privacy_buckets",
      "system_id",
      id,
    ) as PrivacyBucket["systemId"],
    name: guardedStr(row["name"], "privacy_buckets", "name", id),
    description: strOrNull(row["description"], "privacy_buckets", "description", id),
    archived: false,
    createdAt: guardedToMs(row["created_at"], "privacy_buckets", "created_at", id),
    updatedAt,
    version: 0,
  };
  return archived ? wrapArchived(base, updatedAt) : base;
}

export function rowToFriendConnection(
  row: Record<string, unknown>,
): FriendConnection | ArchivedFriendConnection {
  const id = rid(row);
  const archived = intToBool(row["archived"]);
  const updatedAt = guardedToMs(row["updated_at"], "friend_connections", "updated_at", id);
  const base: FriendConnection = {
    id: guardedStr(row["id"], "friend_connections", "id", id) as FriendConnection["id"],
    accountId: guardedStr(
      row["account_id"],
      "friend_connections",
      "account_id",
      id,
    ) as FriendConnection["accountId"],
    friendAccountId: guardedStr(
      row["friend_account_id"],
      "friend_connections",
      "friend_account_id",
      id,
    ) as FriendConnection["friendAccountId"],
    status: guardedStr(
      row["status"],
      "friend_connections",
      "status",
      id,
    ) as FriendConnection["status"],
    assignedBucketIds: parseStringArray(
      row["assigned_buckets"],
      "friend_connections",
      "assigned_buckets",
      id,
    ) as FriendConnection["assignedBucketIds"],
    visibility: parseJsonRequired(
      row["visibility"],
      "friend_connections",
      "visibility",
      id,
    ) as FriendVisibilitySettings,
    archived: false,
    createdAt: guardedToMs(row["created_at"], "friend_connections", "created_at", id),
    updatedAt,
    version: 0,
  };
  return archived ? wrapArchived(base, updatedAt) : base;
}

export function rowToFriendCode(row: Record<string, unknown>): FriendCode | ArchivedFriendCode {
  const id = rid(row);
  const archived = intToBool(row["archived"]);
  const createdAt = guardedToMs(row["created_at"], "friend_codes", "created_at", id);
  const base: FriendCode = {
    id: guardedStr(row["id"], "friend_codes", "id", id) as FriendCode["id"],
    accountId: guardedStr(
      row["account_id"],
      "friend_codes",
      "account_id",
      id,
    ) as FriendCode["accountId"],
    code: guardedStr(row["code"], "friend_codes", "code", id),
    createdAt,
    expiresAt: toMsOrNull(row["expires_at"], "friend_codes", "expires_at", id),
    archived: false,
  };
  return archived ? wrapArchived(base, createdAt) : base;
}
