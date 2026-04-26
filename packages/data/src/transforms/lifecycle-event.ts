import { brandId, toUnixMillis } from "@pluralscape/types";
import { LIFECYCLE_EVENT_ENCRYPTED_SCHEMAS } from "@pluralscape/validation";

import { decodeAndDecryptT1, encryptInput, encryptUpdate } from "./decode-blob.js";

import type { KdfMasterKey } from "@pluralscape/crypto";
import type {
  Archived,
  EntityReference,
  InnerWorldEntityId,
  InnerWorldEntityType,
  InnerWorldRegionId,
  LifecycleEvent,
  LifecycleEventEncryptedInput,
  LifecycleEventId,
  LifecycleEventWire,
  MemberId,
  SystemId,
  SystemStructureEntityId,
} from "@pluralscape/types";

export interface LifecycleEventPage {
  readonly data: readonly LifecycleEventWire[];
  readonly nextCursor: string | null;
}

// ── Helpers ───────────────────────────────────────────────────────────

/** Reads an ID array from plaintextMetadata, returning empty array if absent. */
function metaIds(meta: Record<string, unknown> | null, key: string): readonly string[] {
  const val = meta?.[key];
  if (!Array.isArray(val)) return [];
  return val as readonly string[];
}

function atOrThrow(arr: readonly string[], index: number, label: string): string {
  const value = arr[index];
  if (value === undefined) {
    throw new Error(
      `lifecycleEvent missing required ${label}[${String(index)}] in plaintextMetadata`,
    );
  }
  return value;
}

function firstOrThrow(arr: readonly string[], label: string): string {
  const value = arr[0];
  if (value === undefined) {
    throw new Error(`lifecycleEvent missing required ${label} in plaintextMetadata`);
  }
  return value;
}

// ── Transforms ────────────────────────────────────────────────────────

export function decryptLifecycleEvent(
  raw: LifecycleEventWire,
  masterKey: KdfMasterKey,
): LifecycleEvent | Archived<LifecycleEvent> {
  // Per-variant schema selection: eventType is plaintext on the wire
  const plaintext = decodeAndDecryptT1(raw.encryptedData, masterKey);
  const schema = LIFECYCLE_EVENT_ENCRYPTED_SCHEMAS[raw.eventType];
  const validated = schema.parse(plaintext);

  const shared = {
    id: brandId<LifecycleEventId>(raw.id),
    systemId: brandId<SystemId>(raw.systemId),
    occurredAt: toUnixMillis(raw.occurredAt),
    recordedAt: toUnixMillis(raw.recordedAt),
    notes: validated.notes,
    archived: false as const,
  };

  const meta = raw.plaintextMetadata as Record<string, unknown> | null;

  let domain: LifecycleEvent;

  switch (raw.eventType) {
    case "split": {
      const ids = metaIds(meta, "memberIds");
      if (ids.length < 2) {
        throw new Error("lifecycleEvent split requires at least 2 memberIds in plaintextMetadata");
      }
      domain = {
        ...shared,
        eventType: "split" as const,
        sourceMemberId: brandId<MemberId>(firstOrThrow(ids, "memberIds")),
        resultMemberIds: ids.slice(1).map((id) => brandId<MemberId>(id)),
      };
      break;
    }
    case "fusion": {
      const ids = metaIds(meta, "memberIds");
      if (ids.length < 2) {
        throw new Error("lifecycleEvent fusion requires at least 2 memberIds in plaintextMetadata");
      }
      domain = {
        ...shared,
        eventType: "fusion" as const,
        sourceMemberIds: ids.slice(0, -1).map((id) => brandId<MemberId>(id)),
        resultMemberId: brandId<MemberId>(atOrThrow(ids, ids.length - 1, "memberIds")),
      };
      break;
    }
    case "merge":
      domain = {
        ...shared,
        eventType: "merge" as const,
        memberIds: metaIds(meta, "memberIds").map((id) => brandId<MemberId>(id)),
      };
      break;
    case "unmerge":
      domain = {
        ...shared,
        eventType: "unmerge" as const,
        memberIds: metaIds(meta, "memberIds").map((id) => brandId<MemberId>(id)),
      };
      break;
    case "dormancy-start": {
      const v = validated as { notes: string | null; relatedLifecycleEventId: string | null };
      domain = {
        ...shared,
        eventType: "dormancy-start" as const,
        memberId: brandId<MemberId>(firstOrThrow(metaIds(meta, "memberIds"), "memberIds")),
        relatedLifecycleEventId: v.relatedLifecycleEventId
          ? brandId<LifecycleEventId>(v.relatedLifecycleEventId)
          : null,
      };
      break;
    }
    case "dormancy-end": {
      const v = validated as { notes: string | null; relatedLifecycleEventId: string | null };
      domain = {
        ...shared,
        eventType: "dormancy-end" as const,
        memberId: brandId<MemberId>(firstOrThrow(metaIds(meta, "memberIds"), "memberIds")),
        relatedLifecycleEventId: v.relatedLifecycleEventId
          ? brandId<LifecycleEventId>(v.relatedLifecycleEventId)
          : null,
      };
      break;
    }
    case "discovery":
      domain = {
        ...shared,
        eventType: "discovery" as const,
        memberId: brandId<MemberId>(firstOrThrow(metaIds(meta, "memberIds"), "memberIds")),
      };
      break;
    case "archival": {
      const v = validated as {
        notes: string | null;
        entity: { entityType: string; entityId: string };
      };
      domain = {
        ...shared,
        eventType: "archival" as const,
        entity: v.entity as EntityReference,
      };
      break;
    }
    case "structure-entity-formation":
      domain = {
        ...shared,
        eventType: "structure-entity-formation" as const,
        memberId: brandId<MemberId>(firstOrThrow(metaIds(meta, "memberIds"), "memberIds")),
        resultStructureEntityId: brandId<SystemStructureEntityId>(
          firstOrThrow(metaIds(meta, "structureIds"), "structureIds"),
        ),
      };
      break;
    case "form-change": {
      const v = validated as {
        notes: string | null;
        previousForm: string | null;
        newForm: string | null;
      };
      domain = {
        ...shared,
        eventType: "form-change" as const,
        memberId: brandId<MemberId>(firstOrThrow(metaIds(meta, "memberIds"), "memberIds")),
        previousForm: v.previousForm,
        newForm: v.newForm,
      };
      break;
    }
    case "name-change": {
      const v = validated as { notes: string | null; previousName: string | null; newName: string };
      domain = {
        ...shared,
        eventType: "name-change" as const,
        memberId: brandId<MemberId>(firstOrThrow(metaIds(meta, "memberIds"), "memberIds")),
        previousName: v.previousName,
        newName: v.newName,
      };
      break;
    }
    case "structure-move": {
      const sIds = metaIds(meta, "structureIds");
      if (sIds.length === 0) {
        throw new Error("lifecycleEvent missing required structureIds in plaintextMetadata");
      }
      const mId = brandId<MemberId>(firstOrThrow(metaIds(meta, "memberIds"), "memberIds"));
      const fromStructure: EntityReference<"structure-entity"> | null =
        sIds.length >= 2
          ? {
              entityType: "structure-entity",
              entityId: brandId<SystemStructureEntityId>(atOrThrow(sIds, 0, "structureIds")),
            }
          : null;
      const toStructure: EntityReference<"structure-entity"> =
        sIds.length >= 2
          ? {
              entityType: "structure-entity",
              entityId: brandId<SystemStructureEntityId>(atOrThrow(sIds, 1, "structureIds")),
            }
          : {
              entityType: "structure-entity",
              entityId: brandId<SystemStructureEntityId>(atOrThrow(sIds, 0, "structureIds")),
            };
      domain = {
        ...shared,
        eventType: "structure-move" as const,
        memberId: mId,
        fromStructure,
        toStructure,
      };
      break;
    }
    case "innerworld-move": {
      const eIds = metaIds(meta, "entityIds");
      const rIds = metaIds(meta, "regionIds");
      const v = validated as { notes: string | null; entityType: InnerWorldEntityType };
      const fromRegionId: InnerWorldRegionId | null =
        rIds.length >= 2 ? brandId<InnerWorldRegionId>(atOrThrow(rIds, 0, "regionIds")) : null;
      const toRegionId: InnerWorldRegionId | null =
        rIds.length >= 2
          ? brandId<InnerWorldRegionId>(atOrThrow(rIds, 1, "regionIds"))
          : rIds.length === 1
            ? brandId<InnerWorldRegionId>(atOrThrow(rIds, 0, "regionIds"))
            : null;
      domain = {
        ...shared,
        eventType: "innerworld-move" as const,
        entityId: brandId<InnerWorldEntityId>(firstOrThrow(eIds, "entityIds")),
        entityType: v.entityType,
        fromRegionId,
        toRegionId,
      };
      break;
    }
    default: {
      const _exhaustive: never = raw.eventType;
      throw new Error(`Unknown lifecycle event type: ${String(_exhaustive)}`);
    }
  }

  if (raw.archived) {
    if (raw.archivedAt === null) throw new Error("Archived lifecycleEvent missing archivedAt");
    return {
      ...domain,
      archived: true as const,
      archivedAt: toUnixMillis(raw.archivedAt),
    } as Archived<LifecycleEvent>;
  }
  return domain;
}

export function decryptLifecycleEventPage(
  raw: LifecycleEventPage,
  masterKey: KdfMasterKey,
): {
  data: (LifecycleEvent | Archived<LifecycleEvent>)[];
  nextCursor: string | null;
} {
  return {
    data: raw.data.map((item) => decryptLifecycleEvent(item, masterKey)),
    nextCursor: raw.nextCursor,
  };
}

export function encryptLifecycleEventInput(
  data: LifecycleEventEncryptedInput,
  masterKey: KdfMasterKey,
): { encryptedData: string } {
  return encryptInput(data, masterKey);
}

export function encryptLifecycleEventUpdate(
  data: LifecycleEventEncryptedInput,
  version: number,
  masterKey: KdfMasterKey,
): { encryptedData: string; version: number } {
  return encryptUpdate(data, version, masterKey);
}
