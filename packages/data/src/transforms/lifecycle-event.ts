import { brandId } from "@pluralscape/types";

import {
  assertObjectBlob,
  decodeAndDecryptT1,
  encryptInput,
  encryptUpdate,
} from "./decode-blob.js";

import type { KdfMasterKey } from "@pluralscape/crypto";
import type {
  EntityReference,
  InnerWorldEntityId,
  InnerWorldEntityType,
  InnerWorldRegionId,
  LifecycleEvent,
  LifecycleEventId,
  LifecycleEventType,
  MemberId,
  SystemId,
  SystemStructureEntityId,
  UnixMillis,
} from "@pluralscape/types";

// ── Encrypted payload ─────────────────────────────────────────────────

/** Fields inside the T1 encrypted blob. */
export interface LifecycleEventEncryptedPayload {
  readonly notes: string | null;
  readonly relatedLifecycleEventId?: LifecycleEventId | null;
  readonly previousForm?: string | null;
  readonly newForm?: string | null;
  readonly previousName?: string | null;
  readonly newName?: string;
  readonly entity?: EntityReference;
  readonly entityType?: InnerWorldEntityType;
}

// ── Decrypted output — reuse the domain union ─────────────────────────

export type LifecycleEventDecrypted = LifecycleEvent;

/** A lifecycle event with archive status attached by the transform layer. */
export type LifecycleEventWithArchive =
  | (LifecycleEventDecrypted & { readonly archived: false })
  | (LifecycleEventDecrypted & { readonly archived: true; readonly archivedAt: UnixMillis });

// ── Wire types ────────────────────────────────────────────────────────

/** Plaintext metadata on the wire — unbranded string arrays. */
export interface PlaintextMetadataWire {
  readonly memberIds?: readonly string[];
  readonly structureIds?: readonly string[];
  readonly entityIds?: readonly string[];
  readonly regionIds?: readonly string[];
}

export interface LifecycleEventRaw {
  readonly id: LifecycleEventId;
  readonly systemId: SystemId;
  readonly eventType: LifecycleEventType;
  readonly occurredAt: UnixMillis;
  readonly recordedAt: UnixMillis;
  readonly updatedAt: UnixMillis;
  readonly encryptedData: string | null;
  readonly plaintextMetadata: PlaintextMetadataWire | null;
  readonly version: number;
  readonly archived: boolean;
  readonly archivedAt: UnixMillis | null;
}

export interface LifecycleEventPage {
  readonly data: readonly LifecycleEventRaw[];
  readonly nextCursor: string | null;
}

// ── Validators ────────────────────────────────────────────────────────

function assertLifecycleEventPayload(raw: unknown): asserts raw is LifecycleEventEncryptedPayload {
  assertObjectBlob(raw, "lifecycleEvent");
}

// ── Helpers ───────────────────────────────────────────────────────────

function metaIds(
  meta: PlaintextMetadataWire | null,
  key: keyof PlaintextMetadataWire,
): readonly string[] {
  return meta?.[key] ?? [];
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
  raw: LifecycleEventRaw,
  masterKey: KdfMasterKey,
): LifecycleEventWithArchive {
  let payload: LifecycleEventEncryptedPayload;

  if (raw.encryptedData !== null) {
    const plaintext = decodeAndDecryptT1(raw.encryptedData, masterKey);
    assertLifecycleEventPayload(plaintext);
    payload = plaintext;
  } else {
    payload = { notes: null };
  }

  const shared = {
    id: raw.id,
    systemId: raw.systemId,
    occurredAt: raw.occurredAt,
    recordedAt: raw.recordedAt,
    notes: payload.notes,
  };

  function withArchive<T>(
    base: T,
  ): (T & { archived: false }) | (T & { archived: true; archivedAt: UnixMillis }) {
    if (raw.archived) {
      if (raw.archivedAt === null) throw new Error("Archived lifecycleEvent missing archivedAt");
      return { ...base, archived: true as const, archivedAt: raw.archivedAt };
    }
    return { ...base, archived: false as const };
  }

  const meta = raw.plaintextMetadata;

  switch (raw.eventType) {
    case "split": {
      const ids = metaIds(meta, "memberIds");
      if (ids.length < 2) {
        throw new Error("lifecycleEvent split requires at least 2 memberIds in plaintextMetadata");
      }
      return withArchive({
        ...shared,
        eventType: "split" as const,
        sourceMemberId: brandId<MemberId>(firstOrThrow(ids, "memberIds")),
        resultMemberIds: ids.slice(1).map((id) => brandId<MemberId>(id)),
      });
    }
    case "fusion": {
      const ids = metaIds(meta, "memberIds");
      if (ids.length < 2) {
        throw new Error("lifecycleEvent fusion requires at least 2 memberIds in plaintextMetadata");
      }
      return withArchive({
        ...shared,
        eventType: "fusion" as const,
        sourceMemberIds: ids.slice(0, -1).map((id) => brandId<MemberId>(id)),
        resultMemberId: brandId<MemberId>(atOrThrow(ids, ids.length - 1, "memberIds")),
      });
    }
    case "merge":
      return withArchive({
        ...shared,
        eventType: "merge" as const,
        memberIds: metaIds(meta, "memberIds").map((id) => brandId<MemberId>(id)),
      });
    case "unmerge":
      return withArchive({
        ...shared,
        eventType: "unmerge" as const,
        memberIds: metaIds(meta, "memberIds").map((id) => brandId<MemberId>(id)),
      });
    case "dormancy-start":
      return withArchive({
        ...shared,
        eventType: "dormancy-start" as const,
        memberId: brandId<MemberId>(firstOrThrow(metaIds(meta, "memberIds"), "memberIds")),
        relatedLifecycleEventId: payload.relatedLifecycleEventId
          ? brandId<LifecycleEventId>(payload.relatedLifecycleEventId)
          : null,
      });
    case "dormancy-end":
      return withArchive({
        ...shared,
        eventType: "dormancy-end" as const,
        memberId: brandId<MemberId>(firstOrThrow(metaIds(meta, "memberIds"), "memberIds")),
        relatedLifecycleEventId: payload.relatedLifecycleEventId
          ? brandId<LifecycleEventId>(payload.relatedLifecycleEventId)
          : null,
      });
    case "discovery":
      return withArchive({
        ...shared,
        eventType: "discovery" as const,
        memberId: brandId<MemberId>(firstOrThrow(metaIds(meta, "memberIds"), "memberIds")),
      });
    case "archival": {
      if (payload.entity === undefined) {
        throw new Error("Decrypted lifecycleEvent(archival) blob missing required field: entity");
      }
      return withArchive({
        ...shared,
        eventType: "archival" as const,
        entity: payload.entity,
      });
    }
    case "structure-entity-formation":
      return withArchive({
        ...shared,
        eventType: "structure-entity-formation" as const,
        memberId: brandId<MemberId>(firstOrThrow(metaIds(meta, "memberIds"), "memberIds")),
        resultStructureEntityId: brandId<SystemStructureEntityId>(
          firstOrThrow(metaIds(meta, "structureIds"), "structureIds"),
        ),
      });
    case "form-change":
      return withArchive({
        ...shared,
        eventType: "form-change" as const,
        memberId: brandId<MemberId>(firstOrThrow(metaIds(meta, "memberIds"), "memberIds")),
        previousForm: (payload.previousForm as string | null) ?? null,
        newForm: (payload.newForm as string | null) ?? null,
      });
    case "name-change": {
      if (payload.newName === undefined) {
        throw new Error(
          "Decrypted lifecycleEvent(name-change) blob missing required field: newName",
        );
      }
      return withArchive({
        ...shared,
        eventType: "name-change" as const,
        memberId: brandId<MemberId>(firstOrThrow(metaIds(meta, "memberIds"), "memberIds")),
        previousName: (payload.previousName as string | null) ?? null,
        newName: payload.newName,
      });
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
      return withArchive({
        ...shared,
        eventType: "structure-move" as const,
        memberId: mId,
        fromStructure,
        toStructure,
      });
    }
    case "innerworld-move": {
      const eIds = metaIds(meta, "entityIds");
      const rIds = metaIds(meta, "regionIds");
      const iwEntityType = payload.entityType;
      if (iwEntityType === undefined) {
        throw new Error(
          "Decrypted lifecycleEvent(innerworld-move) blob missing required field: entityType",
        );
      }
      const fromRegionId: InnerWorldRegionId | null =
        rIds.length >= 2 ? brandId<InnerWorldRegionId>(atOrThrow(rIds, 0, "regionIds")) : null;
      const toRegionId: InnerWorldRegionId | null =
        rIds.length >= 2
          ? brandId<InnerWorldRegionId>(atOrThrow(rIds, 1, "regionIds"))
          : rIds.length === 1
            ? brandId<InnerWorldRegionId>(atOrThrow(rIds, 0, "regionIds"))
            : null;
      return withArchive({
        ...shared,
        eventType: "innerworld-move" as const,
        entityId: brandId<InnerWorldEntityId>(firstOrThrow(eIds, "entityIds")),
        entityType: iwEntityType,
        fromRegionId,
        toRegionId,
      });
    }
    default: {
      const _exhaustive: never = raw.eventType;
      throw new Error(`Unknown lifecycle event type: ${String(_exhaustive)}`);
    }
  }
}

export function decryptLifecycleEventPage(
  raw: LifecycleEventPage,
  masterKey: KdfMasterKey,
): {
  data: LifecycleEventWithArchive[];
  nextCursor: string | null;
} {
  return {
    data: raw.data.map((item) => decryptLifecycleEvent(item, masterKey)),
    nextCursor: raw.nextCursor,
  };
}

export function encryptLifecycleEventInput(
  data: LifecycleEventEncryptedPayload,
  masterKey: KdfMasterKey,
): { encryptedData: string } {
  return encryptInput(data, masterKey);
}

export function encryptLifecycleEventUpdate(
  data: LifecycleEventEncryptedPayload,
  version: number,
  masterKey: KdfMasterKey,
): { encryptedData: string; version: number } {
  return encryptUpdate(data, version, masterKey);
}
