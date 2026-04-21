import { importEntityRefs } from "@pluralscape/db/pg";
import { brandId, assertBrandedTargetId, toUnixMillis } from "@pluralscape/types";

import type { AccountId, ImportEntityRef, ImportEntityRefId, SystemId } from "@pluralscape/types";

/**
 * Canonical service result type — delegates to the discriminated union
 * in @pluralscape/types. Consumers narrow via sourceEntityType to get
 * the correct branded target ID without manual casting.
 */
export type ImportEntityRefResult = ImportEntityRef;

export function toResult(row: typeof importEntityRefs.$inferSelect): ImportEntityRef {
  const base = {
    id: brandId<ImportEntityRefId>(row.id),
    accountId: brandId<AccountId>(row.accountId),
    systemId: brandId<SystemId>(row.systemId),
    source: row.source,
    sourceEntityId: row.sourceEntityId,
    importedAt: toUnixMillis(row.importedAt),
  };
  const sourceEntityType = row.sourceEntityType;
  const rawTargetId = row.pluralscapeEntityId;

  // `assertBrandedTargetId` is the single runtime narrowing boundary between
  // raw DB varchars and branded target IDs; all consumers get type-safe
  // narrowing via the sourceEntityType discriminator.
  switch (sourceEntityType) {
    case "member":
      return {
        ...base,
        sourceEntityType,
        pluralscapeEntityId: assertBrandedTargetId("member", rawTargetId),
      };
    case "group":
      return {
        ...base,
        sourceEntityType,
        pluralscapeEntityId: assertBrandedTargetId("group", rawTargetId),
      };
    case "fronting-session":
      return {
        ...base,
        sourceEntityType,
        pluralscapeEntityId: assertBrandedTargetId("fronting-session", rawTargetId),
      };
    case "switch":
      return { ...base, sourceEntityType, pluralscapeEntityId: rawTargetId };
    case "custom-field":
      return {
        ...base,
        sourceEntityType,
        pluralscapeEntityId: assertBrandedTargetId("custom-field", rawTargetId),
      };
    case "note":
      return {
        ...base,
        sourceEntityType,
        pluralscapeEntityId: assertBrandedTargetId("note", rawTargetId),
      };
    case "chat-message":
      return {
        ...base,
        sourceEntityType,
        pluralscapeEntityId: assertBrandedTargetId("chat-message", rawTargetId),
      };
    case "board-message":
      return {
        ...base,
        sourceEntityType,
        pluralscapeEntityId: assertBrandedTargetId("board-message", rawTargetId),
      };
    case "poll":
      return {
        ...base,
        sourceEntityType,
        pluralscapeEntityId: assertBrandedTargetId("poll", rawTargetId),
      };
    case "timer":
      return {
        ...base,
        sourceEntityType,
        pluralscapeEntityId: assertBrandedTargetId("timer", rawTargetId),
      };
    case "privacy-bucket":
      return {
        ...base,
        sourceEntityType,
        pluralscapeEntityId: assertBrandedTargetId("privacy-bucket", rawTargetId),
      };
    case "custom-front":
      return {
        ...base,
        sourceEntityType,
        pluralscapeEntityId: assertBrandedTargetId("custom-front", rawTargetId),
      };
    case "fronting-comment":
      return {
        ...base,
        sourceEntityType,
        pluralscapeEntityId: assertBrandedTargetId("fronting-comment", rawTargetId),
      };
    case "field-definition":
      return {
        ...base,
        sourceEntityType,
        pluralscapeEntityId: assertBrandedTargetId("field-definition", rawTargetId),
      };
    case "field-value":
      return {
        ...base,
        sourceEntityType,
        pluralscapeEntityId: assertBrandedTargetId("field-value", rawTargetId),
      };
    case "journal-entry":
      return {
        ...base,
        sourceEntityType,
        pluralscapeEntityId: assertBrandedTargetId("journal-entry", rawTargetId),
      };
    case "channel-category":
      return {
        ...base,
        sourceEntityType,
        pluralscapeEntityId: assertBrandedTargetId("channel-category", rawTargetId),
      };
    case "channel":
      return {
        ...base,
        sourceEntityType,
        pluralscapeEntityId: assertBrandedTargetId("channel", rawTargetId),
      };
    case "system-profile":
      return {
        ...base,
        sourceEntityType,
        pluralscapeEntityId: assertBrandedTargetId("system-profile", rawTargetId),
      };
    case "system-settings":
      return {
        ...base,
        sourceEntityType,
        pluralscapeEntityId: assertBrandedTargetId("system-settings", rawTargetId),
      };
    case "unknown":
      return { ...base, sourceEntityType, pluralscapeEntityId: rawTargetId };
    default: {
      const _exhaustive: never = sourceEntityType;
      throw new Error(`Unhandled import entity type: ${String(_exhaustive)}`);
    }
  }
}
