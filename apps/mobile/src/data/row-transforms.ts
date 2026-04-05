/**
 * Row transform functions for local SQLite reads.
 *
 * Converts snake_case SQLite row objects (from `LocalDatabase.queryAll` /
 * `queryOne`) to camelCase typed shapes that hooks can consume.
 *
 * Conventions:
 * - INTEGER columns storing booleans (0/1) are converted to `boolean`.
 * - TEXT columns storing JSON-serialized arrays or objects are parsed.
 * - Timestamps (INTEGER, Unix ms) pass through as-is.
 * - `archivedAt` is not stored in SQLite; always `null` in local rows.
 * - `version` is not stored in SQLite; always `0` in local rows.
 *
 * For E2E-encrypted entities the local SQLite holds the **plaintext** fields
 * (materialized from the CRDT document), not an `encryptedData` blob. The
 * returned types therefore omit `encryptedData` and include the plain fields
 * directly, matching the decrypted domain shape.
 */

import type { UnixMillis } from "@pluralscape/types";

// ── Primitive helpers ────────────────────────────────────────────────────────

/** Coerce a 0/1 INTEGER column to boolean. */
function intToBool(v: unknown): boolean {
  return v === 1 || v === true;
}

/** Parse a JSON-serialized TEXT column. Returns `null` when value is null/undefined. */
function parseJson(v: unknown): unknown {
  if (v === null || v === undefined) return null;
  if (typeof v !== "string") return v;
  return JSON.parse(v) as unknown;
}

/** Parse a JSON-serialized TEXT column that is guaranteed non-null in the schema. */
function parseJsonRequired(v: unknown): unknown {
  if (typeof v !== "string") return v;
  return JSON.parse(v) as unknown;
}

/** Parse a JSON-serialized TEXT column as a string array. */
function parseStringArray(v: unknown): readonly string[] {
  return parseJsonRequired(v) as readonly string[];
}

/** Parse a nullable JSON-serialized TEXT column as a string array. */
function parseStringArrayOrNull(v: unknown): readonly string[] | null {
  return parseJson(v) as readonly string[] | null;
}

/** Cast to UnixMillis (branded number). */
function toMs(v: unknown): UnixMillis {
  return v as UnixMillis;
}

/** Cast to UnixMillis or null. */
function toMsOrNull(v: unknown): UnixMillis | null {
  if (v === null || v === undefined) return null;
  return v as UnixMillis;
}

/** Cast to string. */
function str(v: unknown): string {
  return v as string;
}

/** Cast to string or null. */
function strOrNull(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  return v as string;
}

/** Cast to number. */
function num(v: unknown): number {
  return v as number;
}

/** Cast to number or null. */
function numOrNull(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  return v as number;
}

// ── Local row types ──────────────────────────────────────────────────────────
// These are the camelCase shapes returned by each transform function.
// They match the plaintext content of each entity as stored in SQLite.

export interface SystemSettingsLocalRow {
  readonly id: string;
  readonly systemId: string;
  readonly theme: string;
  readonly fontScale: number;
  readonly locale: string | null;
  readonly defaultBucketId: string | null;
  readonly appLock: unknown;
  readonly notifications: unknown;
  readonly syncPreferences: unknown;
  readonly privacyDefaults: unknown;
  readonly littlesSafeMode: unknown;
  readonly nomenclature: unknown;
  readonly saturationLevelsEnabled: boolean;
  readonly autoCaptureFrontingOnJournal: boolean;
  readonly snapshotSchedule: unknown;
  readonly onboardingComplete: boolean;
  readonly createdAt: UnixMillis;
  readonly updatedAt: UnixMillis;
}

export interface MemberLocalRow {
  readonly id: string;
  readonly systemId: string;
  readonly name: string;
  readonly pronouns: readonly string[];
  readonly description: string | null;
  readonly avatarSource: unknown;
  readonly colors: readonly string[];
  readonly saturationLevel: string;
  readonly tags: readonly string[];
  readonly suppressFriendFrontNotification: boolean;
  readonly boardMessageNotificationOnFront: boolean;
  readonly archived: boolean;
  readonly createdAt: UnixMillis;
  readonly updatedAt: UnixMillis;
}

export interface MemberPhotoLocalRow {
  readonly id: string;
  readonly memberId: string;
  readonly imageSource: string;
  readonly sortOrder: number;
  readonly caption: string | null;
  readonly archived: boolean;
}

export interface GroupLocalRow {
  readonly id: string;
  readonly systemId: string;
  readonly name: string;
  readonly description: string | null;
  readonly parentGroupId: string | null;
  readonly imageSource: string | null;
  readonly color: string | null;
  readonly emoji: string | null;
  readonly sortOrder: number;
  readonly archived: boolean;
  readonly createdAt: UnixMillis;
  readonly updatedAt: UnixMillis;
}

export interface StructureEntityTypeLocalRow {
  readonly id: string;
  readonly systemId: string;
  readonly name: string;
  readonly description: string | null;
  readonly color: string | null;
  readonly imageSource: string | null;
  readonly emoji: string | null;
  readonly sortOrder: number;
  readonly archived: boolean;
  readonly createdAt: UnixMillis;
  readonly updatedAt: UnixMillis;
}

export interface StructureEntityLocalRow {
  readonly id: string;
  readonly systemId: string;
  readonly entityTypeId: string;
  readonly name: string;
  readonly description: string | null;
  readonly color: string | null;
  readonly imageSource: string | null;
  readonly emoji: string | null;
  readonly sortOrder: number;
  readonly archived: boolean;
  readonly createdAt: UnixMillis;
  readonly updatedAt: UnixMillis;
}

export interface StructureEntityLinkLocalRow {
  readonly id: string;
  readonly systemId: string;
  readonly entityId: string;
  readonly parentEntityId: string | null;
  readonly sortOrder: number;
  readonly archived: boolean;
  readonly createdAt: UnixMillis;
  readonly updatedAt: UnixMillis;
}

export interface StructureEntityMemberLinkLocalRow {
  readonly id: string;
  readonly systemId: string;
  readonly memberId: string;
  readonly parentEntityId: string | null;
  readonly sortOrder: number;
  readonly archived: boolean;
  readonly createdAt: UnixMillis;
  readonly updatedAt: UnixMillis;
}

export interface StructureEntityAssociationLocalRow {
  readonly id: string;
  readonly systemId: string;
  readonly sourceEntityId: string;
  readonly targetEntityId: string;
  readonly archived: boolean;
  readonly createdAt: UnixMillis;
  readonly updatedAt: UnixMillis;
}

export interface RelationshipLocalRow {
  readonly id: string;
  readonly systemId: string;
  readonly sourceMemberId: string | null;
  readonly targetMemberId: string | null;
  readonly type: string;
  readonly label: string | null;
  readonly bidirectional: boolean;
  readonly createdAt: UnixMillis;
  readonly archived: boolean;
}

export interface CustomFrontLocalRow {
  readonly id: string;
  readonly systemId: string;
  readonly name: string;
  readonly description: string | null;
  readonly color: string | null;
  readonly emoji: string | null;
  readonly archived: boolean;
  readonly createdAt: UnixMillis;
  readonly updatedAt: UnixMillis;
}

export interface FrontingReportLocalRow {
  readonly id: string;
  readonly systemId: string;
  readonly encryptedData: string;
  readonly format: string;
  readonly generatedAt: UnixMillis;
}

export interface FieldDefinitionLocalRow {
  readonly id: string;
  readonly systemId: string;
  readonly name: string;
  readonly description: string | null;
  readonly fieldType: string;
  readonly options: readonly string[] | null;
  readonly required: boolean;
  readonly sortOrder: number;
  readonly scopes: readonly string[];
  readonly archived: boolean;
  readonly createdAt: UnixMillis;
  readonly updatedAt: UnixMillis;
}

export interface FieldValueLocalRow {
  readonly id: string;
  readonly fieldDefinitionId: string;
  readonly memberId: string | null;
  readonly structureEntityId: string | null;
  readonly groupId: string | null;
  readonly value: unknown;
  readonly createdAt: UnixMillis;
  readonly updatedAt: UnixMillis;
}

export interface InnerWorldEntityLocalRow {
  readonly id: string;
  readonly systemId: string;
  readonly entityType: string;
  readonly positionX: number;
  readonly positionY: number;
  readonly visual: unknown;
  readonly regionId: string | null;
  readonly linkedMemberId: string | null;
  readonly linkedStructureEntityId: string | null;
  readonly name: string | null;
  readonly description: string | null;
  readonly archived: boolean;
  readonly createdAt: UnixMillis;
  readonly updatedAt: UnixMillis;
}

export interface InnerWorldRegionLocalRow {
  readonly id: string;
  readonly systemId: string;
  readonly name: string;
  readonly description: string | null;
  readonly parentRegionId: string | null;
  readonly visual: unknown;
  readonly boundaryData: unknown;
  readonly accessType: string;
  readonly gatekeeperMemberIds: readonly string[];
  readonly archived: boolean;
  readonly createdAt: UnixMillis;
  readonly updatedAt: UnixMillis;
}

export interface TimerLocalRow {
  readonly id: string;
  readonly systemId: string;
  readonly intervalMinutes: number | null;
  readonly wakingHoursOnly: boolean | null;
  readonly wakingStart: string | null;
  readonly wakingEnd: string | null;
  readonly promptText: string;
  readonly enabled: boolean;
  readonly archived: boolean;
  readonly createdAt: UnixMillis;
  readonly updatedAt: UnixMillis;
}

export interface LifecycleEventLocalRow {
  readonly id: string;
  readonly systemId: string;
  readonly eventType: string;
  readonly occurredAt: UnixMillis;
  readonly recordedAt: UnixMillis;
  readonly notes: string | null;
  readonly payload: unknown;
  readonly archived: boolean;
}

export interface FrontingSessionLocalRow {
  readonly id: string;
  readonly systemId: string;
  readonly memberId: string;
  readonly startTime: UnixMillis;
  readonly endTime: UnixMillis | null;
  readonly comment: string | null;
  readonly customFrontId: string | null;
  readonly structureEntityId: string | null;
  readonly positionality: string | null;
  readonly outtrigger: string | null;
  readonly outtriggerSentiment: string | null;
  readonly archived: boolean;
  readonly createdAt: UnixMillis;
  readonly updatedAt: UnixMillis;
}

export interface FrontingCommentLocalRow {
  readonly id: string;
  readonly frontingSessionId: string;
  readonly systemId: string;
  readonly memberId: string | null;
  readonly customFrontId: string | null;
  readonly structureEntityId: string | null;
  readonly content: string;
  readonly archived: boolean;
  readonly createdAt: UnixMillis;
  readonly updatedAt: UnixMillis;
}

export interface CheckInRecordLocalRow {
  readonly id: string;
  readonly timerConfigId: string;
  readonly systemId: string;
  readonly scheduledAt: UnixMillis;
  readonly respondedByMemberId: string | null;
  readonly respondedAt: UnixMillis | null;
  readonly dismissed: boolean;
  readonly archived: boolean;
  readonly archivedAt: UnixMillis | null;
  readonly createdAt: UnixMillis;
  readonly updatedAt: UnixMillis;
}

export interface ChannelLocalRow {
  readonly id: string;
  readonly systemId: string;
  readonly name: string;
  readonly type: string;
  readonly parentId: string | null;
  readonly sortOrder: number;
  readonly archived: boolean;
  readonly createdAt: UnixMillis;
  readonly updatedAt: UnixMillis;
}

export interface MessageLocalRow {
  readonly id: string;
  readonly channelId: string;
  readonly systemId: string;
  readonly senderId: string;
  readonly content: string;
  readonly attachments: readonly string[];
  readonly mentions: readonly string[];
  readonly replyToId: string | null;
  readonly timestamp: UnixMillis;
  readonly editOf: string | null;
  readonly archived: boolean;
}

export interface BoardMessageLocalRow {
  readonly id: string;
  readonly systemId: string;
  readonly senderId: string;
  readonly content: string;
  readonly pinned: boolean;
  readonly sortOrder: number;
  readonly archived: boolean;
  readonly createdAt: UnixMillis;
  readonly updatedAt: UnixMillis;
}

export interface PollLocalRow {
  readonly id: string;
  readonly systemId: string;
  readonly createdByMemberId: string | null;
  readonly title: string;
  readonly description: string | null;
  readonly kind: string;
  readonly status: string;
  readonly closedAt: UnixMillis | null;
  readonly endsAt: UnixMillis | null;
  readonly allowMultipleVotes: boolean;
  readonly maxVotesPerMember: number;
  readonly allowAbstain: boolean;
  readonly allowVeto: boolean;
  readonly archived: boolean;
  readonly createdAt: UnixMillis;
  readonly updatedAt: UnixMillis;
}

export interface AcknowledgementLocalRow {
  readonly id: string;
  readonly systemId: string;
  readonly createdByMemberId: string | null;
  readonly targetMemberId: string;
  readonly message: string;
  readonly confirmed: boolean;
  readonly confirmedAt: UnixMillis | null;
  readonly archived: boolean;
  readonly createdAt: UnixMillis;
  readonly updatedAt: UnixMillis;
}

export interface JournalEntryLocalRow {
  readonly id: string;
  readonly systemId: string;
  readonly author: string | null;
  readonly frontingSessionId: string | null;
  readonly title: string;
  readonly blocks: unknown;
  readonly tags: readonly string[];
  readonly linkedEntities: unknown;
  readonly frontingSnapshots: unknown;
  readonly archived: boolean;
  readonly createdAt: UnixMillis;
  readonly updatedAt: UnixMillis;
}

export interface WikiPageLocalRow {
  readonly id: string;
  readonly systemId: string;
  readonly title: string;
  readonly slug: string;
  readonly blocks: unknown;
  readonly linkedFromPages: readonly string[];
  readonly tags: readonly string[];
  readonly linkedEntities: unknown;
  readonly archived: boolean;
  readonly createdAt: UnixMillis;
  readonly updatedAt: UnixMillis;
}

export interface NoteLocalRow {
  readonly id: string;
  readonly systemId: string;
  readonly authorEntityType: string | null;
  readonly authorEntityId: string | null;
  readonly title: string;
  readonly content: string;
  readonly backgroundColor: string | null;
  readonly archived: boolean;
  readonly createdAt: UnixMillis;
  readonly updatedAt: UnixMillis;
}

export interface PrivacyBucketLocalRow {
  readonly id: string;
  readonly systemId: string;
  readonly name: string;
  readonly description: string | null;
  readonly archived: boolean;
  readonly archivedAt: UnixMillis | null;
  readonly version: number;
  readonly createdAt: UnixMillis;
  readonly updatedAt: UnixMillis;
}

export interface FriendConnectionLocalRow {
  readonly id: string;
  readonly accountId: string;
  readonly friendAccountId: string;
  readonly status: string;
  readonly assignedBuckets: readonly string[];
  readonly visibility: unknown;
  readonly archived: boolean;
  readonly archivedAt: UnixMillis | null;
  readonly version: number;
  readonly createdAt: UnixMillis;
  readonly updatedAt: UnixMillis;
}

export interface FriendCodeLocalRow {
  readonly id: string;
  readonly accountId: string;
  readonly code: string;
  readonly createdAt: UnixMillis;
  readonly expiresAt: UnixMillis | null;
  readonly archived: boolean;
  readonly archivedAt: UnixMillis | null;
}

// ── Transform functions ──────────────────────────────────────────────────────

// ── system-core ──────────────────────────────────────────────────────────────

export function rowToSystemSettingsRow(row: Record<string, unknown>): SystemSettingsLocalRow {
  return {
    id: str(row["id"]),
    systemId: str(row["system_id"]),
    theme: str(row["theme"]),
    fontScale: num(row["font_scale"]),
    locale: strOrNull(row["locale"]),
    defaultBucketId: strOrNull(row["default_bucket_id"]),
    appLock: parseJsonRequired(row["app_lock"]),
    notifications: parseJsonRequired(row["notifications"]),
    syncPreferences: parseJsonRequired(row["sync_preferences"]),
    privacyDefaults: parseJsonRequired(row["privacy_defaults"]),
    littlesSafeMode: parseJsonRequired(row["littles_safe_mode"]),
    nomenclature: parseJsonRequired(row["nomenclature"]),
    saturationLevelsEnabled: intToBool(row["saturation_levels_enabled"]),
    autoCaptureFrontingOnJournal: intToBool(row["auto_capture_fronting_on_journal"]),
    snapshotSchedule: parseJsonRequired(row["snapshot_schedule"]),
    onboardingComplete: intToBool(row["onboarding_complete"]),
    createdAt: toMs(row["created_at"]),
    updatedAt: toMs(row["updated_at"]),
  };
}

export function rowToMemberRow(row: Record<string, unknown>): MemberLocalRow {
  return {
    id: str(row["id"]),
    systemId: str(row["system_id"]),
    name: str(row["name"]),
    pronouns: parseStringArray(row["pronouns"]),
    description: strOrNull(row["description"]),
    avatarSource: row["avatar_source"] ?? null,
    colors: parseStringArray(row["colors"]),
    saturationLevel: str(row["saturation_level"]),
    tags: parseStringArray(row["tags"]),
    suppressFriendFrontNotification: intToBool(row["suppress_friend_front_notification"]),
    boardMessageNotificationOnFront: intToBool(row["board_message_notification_on_front"]),
    archived: intToBool(row["archived"]),
    createdAt: toMs(row["created_at"]),
    updatedAt: toMs(row["updated_at"]),
  };
}

export function rowToMemberPhotoRow(row: Record<string, unknown>): MemberPhotoLocalRow {
  return {
    id: str(row["id"]),
    memberId: str(row["member_id"]),
    imageSource: str(row["image_source"]),
    sortOrder: num(row["sort_order"]),
    caption: strOrNull(row["caption"]),
    archived: intToBool(row["archived"]),
  };
}

export function rowToGroupRow(row: Record<string, unknown>): GroupLocalRow {
  return {
    id: str(row["id"]),
    systemId: str(row["system_id"]),
    name: str(row["name"]),
    description: strOrNull(row["description"]),
    parentGroupId: strOrNull(row["parent_group_id"]),
    imageSource: strOrNull(row["image_source"]),
    color: strOrNull(row["color"]),
    emoji: strOrNull(row["emoji"]),
    sortOrder: num(row["sort_order"]),
    archived: intToBool(row["archived"]),
    createdAt: toMs(row["created_at"]),
    updatedAt: toMs(row["updated_at"]),
  };
}

export function rowToStructureEntityTypeRow(
  row: Record<string, unknown>,
): StructureEntityTypeLocalRow {
  return {
    id: str(row["id"]),
    systemId: str(row["system_id"]),
    name: str(row["name"]),
    description: strOrNull(row["description"]),
    color: strOrNull(row["color"]),
    imageSource: strOrNull(row["image_source"]),
    emoji: strOrNull(row["emoji"]),
    sortOrder: num(row["sort_order"]),
    archived: intToBool(row["archived"]),
    createdAt: toMs(row["created_at"]),
    updatedAt: toMs(row["updated_at"]),
  };
}

export function rowToStructureEntityRow(row: Record<string, unknown>): StructureEntityLocalRow {
  return {
    id: str(row["id"]),
    systemId: str(row["system_id"]),
    entityTypeId: str(row["entity_type_id"]),
    name: str(row["name"]),
    description: strOrNull(row["description"]),
    color: strOrNull(row["color"]),
    imageSource: strOrNull(row["image_source"]),
    emoji: strOrNull(row["emoji"]),
    sortOrder: num(row["sort_order"]),
    archived: intToBool(row["archived"]),
    createdAt: toMs(row["created_at"]),
    updatedAt: toMs(row["updated_at"]),
  };
}

export function rowToStructureEntityLinkRow(
  row: Record<string, unknown>,
): StructureEntityLinkLocalRow {
  return {
    id: str(row["id"]),
    systemId: str(row["system_id"]),
    entityId: str(row["entity_id"]),
    parentEntityId: strOrNull(row["parent_entity_id"]),
    sortOrder: num(row["sort_order"]),
    archived: intToBool(row["archived"]),
    createdAt: toMs(row["created_at"]),
    updatedAt: toMs(row["updated_at"]),
  };
}

export function rowToStructureEntityMemberLinkRow(
  row: Record<string, unknown>,
): StructureEntityMemberLinkLocalRow {
  return {
    id: str(row["id"]),
    systemId: str(row["system_id"]),
    memberId: str(row["member_id"]),
    parentEntityId: strOrNull(row["parent_entity_id"]),
    sortOrder: num(row["sort_order"]),
    archived: intToBool(row["archived"]),
    createdAt: toMs(row["created_at"]),
    updatedAt: toMs(row["updated_at"]),
  };
}

export function rowToStructureEntityAssociationRow(
  row: Record<string, unknown>,
): StructureEntityAssociationLocalRow {
  return {
    id: str(row["id"]),
    systemId: str(row["system_id"]),
    sourceEntityId: str(row["source_entity_id"]),
    targetEntityId: str(row["target_entity_id"]),
    archived: intToBool(row["archived"]),
    createdAt: toMs(row["created_at"]),
    updatedAt: toMs(row["updated_at"]),
  };
}

export function rowToRelationshipRow(row: Record<string, unknown>): RelationshipLocalRow {
  return {
    id: str(row["id"]),
    systemId: str(row["system_id"]),
    sourceMemberId: strOrNull(row["source_member_id"]),
    targetMemberId: strOrNull(row["target_member_id"]),
    type: str(row["type"]),
    label: strOrNull(row["label"]),
    bidirectional: intToBool(row["bidirectional"]),
    createdAt: toMs(row["created_at"]),
    archived: intToBool(row["archived"]),
  };
}

export function rowToCustomFrontRow(row: Record<string, unknown>): CustomFrontLocalRow {
  return {
    id: str(row["id"]),
    systemId: str(row["system_id"]),
    name: str(row["name"]),
    description: strOrNull(row["description"]),
    color: strOrNull(row["color"]),
    emoji: strOrNull(row["emoji"]),
    archived: intToBool(row["archived"]),
    createdAt: toMs(row["created_at"]),
    updatedAt: toMs(row["updated_at"]),
  };
}

export function rowToFieldDefinitionRow(row: Record<string, unknown>): FieldDefinitionLocalRow {
  return {
    id: str(row["id"]),
    systemId: str(row["system_id"]),
    name: str(row["name"]),
    description: strOrNull(row["description"]),
    fieldType: str(row["field_type"]),
    options: parseStringArrayOrNull(row["options"]),
    required: intToBool(row["required"]),
    sortOrder: num(row["sort_order"]),
    scopes: parseStringArray(row["scopes"]),
    archived: intToBool(row["archived"]),
    createdAt: toMs(row["created_at"]),
    updatedAt: toMs(row["updated_at"]),
  };
}

export function rowToFieldValueRow(row: Record<string, unknown>): FieldValueLocalRow {
  return {
    id: str(row["id"]),
    fieldDefinitionId: str(row["field_definition_id"]),
    memberId: strOrNull(row["member_id"]),
    structureEntityId: strOrNull(row["structure_entity_id"]),
    groupId: strOrNull(row["group_id"]),
    value: parseJson(row["value"]),
    createdAt: toMs(row["created_at"]),
    updatedAt: toMs(row["updated_at"]),
  };
}

export function rowToInnerWorldEntityRow(row: Record<string, unknown>): InnerWorldEntityLocalRow {
  return {
    id: str(row["id"]),
    systemId: str(row["system_id"]),
    entityType: str(row["entity_type"]),
    positionX: num(row["position_x"]),
    positionY: num(row["position_y"]),
    visual: parseJsonRequired(row["visual"]),
    regionId: strOrNull(row["region_id"]),
    linkedMemberId: strOrNull(row["linked_member_id"]),
    linkedStructureEntityId: strOrNull(row["linked_structure_entity_id"]),
    name: strOrNull(row["name"]),
    description: strOrNull(row["description"]),
    archived: intToBool(row["archived"]),
    createdAt: toMs(row["created_at"]),
    updatedAt: toMs(row["updated_at"]),
  };
}

export function rowToInnerWorldRegionRow(row: Record<string, unknown>): InnerWorldRegionLocalRow {
  return {
    id: str(row["id"]),
    systemId: str(row["system_id"]),
    name: str(row["name"]),
    description: strOrNull(row["description"]),
    parentRegionId: strOrNull(row["parent_region_id"]),
    visual: parseJsonRequired(row["visual"]),
    boundaryData: parseJsonRequired(row["boundary_data"]),
    accessType: str(row["access_type"]),
    gatekeeperMemberIds: parseStringArray(row["gatekeeper_member_ids"]),
    archived: intToBool(row["archived"]),
    createdAt: toMs(row["created_at"]),
    updatedAt: toMs(row["updated_at"]),
  };
}

export function rowToTimerRow(row: Record<string, unknown>): TimerLocalRow {
  const wakingHoursOnly =
    row["waking_hours_only"] === null || row["waking_hours_only"] === undefined
      ? null
      : intToBool(row["waking_hours_only"]);
  return {
    id: str(row["id"]),
    systemId: str(row["system_id"]),
    intervalMinutes: numOrNull(row["interval_minutes"]),
    wakingHoursOnly,
    wakingStart: strOrNull(row["waking_start"]),
    wakingEnd: strOrNull(row["waking_end"]),
    promptText: str(row["prompt_text"]),
    enabled: intToBool(row["enabled"]),
    archived: intToBool(row["archived"]),
    createdAt: toMs(row["created_at"]),
    updatedAt: toMs(row["updated_at"]),
  };
}

export function rowToLifecycleEventRow(row: Record<string, unknown>): LifecycleEventLocalRow {
  return {
    id: str(row["id"]),
    systemId: str(row["system_id"]),
    eventType: str(row["event_type"]),
    occurredAt: toMs(row["occurred_at"]),
    recordedAt: toMs(row["recorded_at"]),
    notes: strOrNull(row["notes"]),
    payload: parseJsonRequired(row["payload"]),
    archived: intToBool(row["archived"]),
  };
}

// ── fronting document ────────────────────────────────────────────────────────

export function rowToFrontingSessionRow(row: Record<string, unknown>): FrontingSessionLocalRow {
  return {
    id: str(row["id"]),
    systemId: str(row["system_id"]),
    memberId: str(row["member_id"]),
    startTime: toMs(row["start_time"]),
    endTime: toMsOrNull(row["end_time"]),
    comment: strOrNull(row["comment"]),
    customFrontId: strOrNull(row["custom_front_id"]),
    structureEntityId: strOrNull(row["structure_entity_id"]),
    positionality: strOrNull(row["positionality"]),
    outtrigger: strOrNull(row["outtrigger"]),
    outtriggerSentiment: strOrNull(row["outtrigger_sentiment"]),
    archived: intToBool(row["archived"]),
    createdAt: toMs(row["created_at"]),
    updatedAt: toMs(row["updated_at"]),
  };
}

export function rowToFrontingCommentRow(row: Record<string, unknown>): FrontingCommentLocalRow {
  return {
    id: str(row["id"]),
    frontingSessionId: str(row["fronting_session_id"]),
    systemId: str(row["system_id"]),
    memberId: strOrNull(row["member_id"]),
    customFrontId: strOrNull(row["custom_front_id"]),
    structureEntityId: strOrNull(row["structure_entity_id"]),
    content: str(row["content"]),
    archived: intToBool(row["archived"]),
    createdAt: toMs(row["created_at"]),
    updatedAt: toMs(row["updated_at"]),
  };
}

export function rowToCheckInRecordRow(row: Record<string, unknown>): CheckInRecordLocalRow {
  return {
    id: str(row["id"]),
    timerConfigId: str(row["timer_config_id"]),
    systemId: str(row["system_id"]),
    scheduledAt: toMs(row["scheduled_at"]),
    respondedByMemberId: strOrNull(row["responded_by_member_id"]),
    respondedAt: toMsOrNull(row["responded_at"]),
    dismissed: intToBool(row["dismissed"]),
    archived: intToBool(row["archived"]),
    archivedAt: null,
    createdAt: toMs(row["created_at"]),
    updatedAt: toMs(row["updated_at"]),
  };
}

export function rowToFrontingReportRow(row: Record<string, unknown>): FrontingReportLocalRow {
  return {
    id: str(row["id"]),
    systemId: str(row["system_id"]),
    encryptedData: str(row["encrypted_data"]),
    format: str(row["format"]),
    generatedAt: toMs(row["generated_at"]),
  };
}

// ── chat document ────────────────────────────────────────────────────────────

export function rowToChannelRow(row: Record<string, unknown>): ChannelLocalRow {
  return {
    id: str(row["id"]),
    systemId: str(row["system_id"]),
    name: str(row["name"]),
    type: str(row["type"]),
    parentId: strOrNull(row["parent_id"]),
    sortOrder: num(row["sort_order"]),
    archived: intToBool(row["archived"]),
    createdAt: toMs(row["created_at"]),
    updatedAt: toMs(row["updated_at"]),
  };
}

export function rowToMessageRow(row: Record<string, unknown>): MessageLocalRow {
  return {
    id: str(row["id"]),
    channelId: str(row["channel_id"]),
    systemId: str(row["system_id"]),
    senderId: str(row["sender_id"]),
    content: str(row["content"]),
    attachments: parseStringArray(row["attachments"]),
    mentions: parseStringArray(row["mentions"]),
    replyToId: strOrNull(row["reply_to_id"]),
    timestamp: toMs(row["timestamp"]),
    editOf: strOrNull(row["edit_of"]),
    archived: intToBool(row["archived"]),
  };
}

export function rowToBoardMessageRow(row: Record<string, unknown>): BoardMessageLocalRow {
  return {
    id: str(row["id"]),
    systemId: str(row["system_id"]),
    senderId: str(row["sender_id"]),
    content: str(row["content"]),
    pinned: intToBool(row["pinned"]),
    sortOrder: num(row["sort_order"]),
    archived: intToBool(row["archived"]),
    createdAt: toMs(row["created_at"]),
    updatedAt: toMs(row["updated_at"]),
  };
}

export function rowToPollRow(row: Record<string, unknown>): PollLocalRow {
  return {
    id: str(row["id"]),
    systemId: str(row["system_id"]),
    createdByMemberId: strOrNull(row["created_by_member_id"]),
    title: str(row["title"]),
    description: strOrNull(row["description"]),
    kind: str(row["kind"]),
    status: str(row["status"]),
    closedAt: toMsOrNull(row["closed_at"]),
    endsAt: toMsOrNull(row["ends_at"]),
    allowMultipleVotes: intToBool(row["allow_multiple_votes"]),
    maxVotesPerMember: num(row["max_votes_per_member"]),
    allowAbstain: intToBool(row["allow_abstain"]),
    allowVeto: intToBool(row["allow_veto"]),
    archived: intToBool(row["archived"]),
    createdAt: toMs(row["created_at"]),
    updatedAt: toMs(row["updated_at"]),
  };
}

export function rowToAcknowledgementRow(row: Record<string, unknown>): AcknowledgementLocalRow {
  return {
    id: str(row["id"]),
    systemId: str(row["system_id"]),
    createdByMemberId: strOrNull(row["created_by_member_id"]),
    targetMemberId: str(row["target_member_id"]),
    message: str(row["message"]),
    confirmed: intToBool(row["confirmed"]),
    confirmedAt: toMsOrNull(row["confirmed_at"]),
    archived: intToBool(row["archived"]),
    createdAt: toMs(row["created_at"]),
    updatedAt: toMs(row["updated_at"]),
  };
}

// ── journal document ─────────────────────────────────────────────────────────

export function rowToJournalEntryRow(row: Record<string, unknown>): JournalEntryLocalRow {
  return {
    id: str(row["id"]),
    systemId: str(row["system_id"]),
    author: strOrNull(row["author"]),
    frontingSessionId: strOrNull(row["fronting_session_id"]),
    title: str(row["title"]),
    blocks: parseJsonRequired(row["blocks"]),
    tags: parseStringArray(row["tags"]),
    linkedEntities: parseJsonRequired(row["linked_entities"]),
    frontingSnapshots: parseJson(row["fronting_snapshots"]),
    archived: intToBool(row["archived"]),
    createdAt: toMs(row["created_at"]),
    updatedAt: toMs(row["updated_at"]),
  };
}

export function rowToWikiPageRow(row: Record<string, unknown>): WikiPageLocalRow {
  return {
    id: str(row["id"]),
    systemId: str(row["system_id"]),
    title: str(row["title"]),
    slug: str(row["slug"]),
    blocks: parseJsonRequired(row["blocks"]),
    linkedFromPages: parseStringArray(row["linked_from_pages"]),
    tags: parseStringArray(row["tags"]),
    linkedEntities: parseJsonRequired(row["linked_entities"]),
    archived: intToBool(row["archived"]),
    createdAt: toMs(row["created_at"]),
    updatedAt: toMs(row["updated_at"]),
  };
}

export function rowToNoteRow(row: Record<string, unknown>): NoteLocalRow {
  return {
    id: str(row["id"]),
    systemId: str(row["system_id"]),
    authorEntityType: strOrNull(row["author_entity_type"]),
    authorEntityId: strOrNull(row["author_entity_id"]),
    title: str(row["title"]),
    content: str(row["content"]),
    backgroundColor: strOrNull(row["background_color"]),
    archived: intToBool(row["archived"]),
    createdAt: toMs(row["created_at"]),
    updatedAt: toMs(row["updated_at"]),
  };
}

// ── privacy-config document ──────────────────────────────────────────────────

export function rowToPrivacyBucketRow(row: Record<string, unknown>): PrivacyBucketLocalRow {
  return {
    id: str(row["id"]),
    systemId: str(row["system_id"]),
    name: str(row["name"]),
    description: strOrNull(row["description"]),
    archived: intToBool(row["archived"]),
    archivedAt: null,
    version: 0,
    createdAt: toMs(row["created_at"]),
    updatedAt: toMs(row["updated_at"]),
  };
}

export function rowToFriendConnectionRow(row: Record<string, unknown>): FriendConnectionLocalRow {
  return {
    id: str(row["id"]),
    accountId: str(row["account_id"]),
    friendAccountId: str(row["friend_account_id"]),
    status: str(row["status"]),
    assignedBuckets: parseStringArray(row["assigned_buckets"]),
    visibility: parseJsonRequired(row["visibility"]),
    archived: intToBool(row["archived"]),
    archivedAt: null,
    version: 0,
    createdAt: toMs(row["created_at"]),
    updatedAt: toMs(row["updated_at"]),
  };
}

export function rowToFriendCodeRow(row: Record<string, unknown>): FriendCodeLocalRow {
  return {
    id: str(row["id"]),
    accountId: str(row["account_id"]),
    code: str(row["code"]),
    createdAt: toMs(row["created_at"]),
    expiresAt: toMsOrNull(row["expires_at"]),
    archived: intToBool(row["archived"]),
    archivedAt: null,
  };
}
