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

function memberIds(meta: PlaintextMetadataWire | null): readonly string[] {
  return meta?.memberIds ?? [];
}

function structureIds(meta: PlaintextMetadataWire | null): readonly string[] {
  return meta?.structureIds ?? [];
}

function entityIds(meta: PlaintextMetadataWire | null): readonly string[] {
  return meta?.entityIds ?? [];
}

function regionIds(meta: PlaintextMetadataWire | null): readonly string[] {
  return meta?.regionIds ?? [];
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
      const ids = memberIds(meta);
      return withArchive({
        ...shared,
        eventType: "split" as const,
        sourceMemberId: ids[0] as MemberId,
        resultMemberIds: ids.slice(1) as MemberId[],
      });
    }
    case "fusion": {
      const ids = memberIds(meta);
      return withArchive({
        ...shared,
        eventType: "fusion" as const,
        sourceMemberIds: ids.slice(0, -1) as MemberId[],
        resultMemberId: ids[ids.length - 1] as MemberId,
      });
    }
    case "merge":
      return withArchive({
        ...shared,
        eventType: "merge" as const,
        memberIds: memberIds(meta) as MemberId[],
      });
    case "unmerge":
      return withArchive({
        ...shared,
        eventType: "unmerge" as const,
        memberIds: memberIds(meta) as MemberId[],
      });
    case "dormancy-start":
      return withArchive({
        ...shared,
        eventType: "dormancy-start" as const,
        memberId: memberIds(meta)[0] as MemberId,
        relatedLifecycleEventId:
          (payload.relatedLifecycleEventId as LifecycleEventId | null) ?? null,
      });
    case "dormancy-end":
      return withArchive({
        ...shared,
        eventType: "dormancy-end" as const,
        memberId: memberIds(meta)[0] as MemberId,
        relatedLifecycleEventId:
          (payload.relatedLifecycleEventId as LifecycleEventId | null) ?? null,
      });
    case "discovery":
      return withArchive({
        ...shared,
        eventType: "discovery" as const,
        memberId: memberIds(meta)[0] as MemberId,
      });
    case "archival":
      return withArchive({
        ...shared,
        eventType: "archival" as const,
        entity: payload.entity as EntityReference,
      });
    case "structure-entity-formation":
      return withArchive({
        ...shared,
        eventType: "structure-entity-formation" as const,
        memberId: memberIds(meta)[0] as MemberId,
        resultStructureEntityId: structureIds(meta)[0] as SystemStructureEntityId,
      });
    case "form-change":
      return withArchive({
        ...shared,
        eventType: "form-change" as const,
        memberId: memberIds(meta)[0] as MemberId,
        previousForm: (payload.previousForm as string | null) ?? null,
        newForm: (payload.newForm as string | null) ?? null,
      });
    case "name-change":
      return withArchive({
        ...shared,
        eventType: "name-change" as const,
        memberId: memberIds(meta)[0] as MemberId,
        previousName: (payload.previousName as string | null) ?? null,
        newName: payload.newName as string,
      });
    case "structure-move": {
      const sIds = structureIds(meta);
      const fromStructure: EntityReference<"structure-entity"> | null =
        sIds.length >= 2 ? { entityType: "structure-entity", entityId: sIds[0] as string } : null;
      const toStructure: EntityReference<"structure-entity"> =
        sIds.length >= 2
          ? { entityType: "structure-entity", entityId: sIds[1] as string }
          : { entityType: "structure-entity", entityId: sIds[0] as string };
      return withArchive({
        ...shared,
        eventType: "structure-move" as const,
        memberId: memberIds(meta)[0] as MemberId,
        fromStructure,
        toStructure,
      });
    }
    case "innerworld-move": {
      const eIds = entityIds(meta);
      const rIds = regionIds(meta);
      const iwEntityType = payload.entityType;
      if (iwEntityType === undefined) {
        throw new Error(
          "Decrypted lifecycleEvent(innerworld-move) blob missing required field: entityType",
        );
      }
      const fromRegionId: InnerWorldRegionId | null =
        rIds.length >= 2 ? (rIds[0] as InnerWorldRegionId) : null;
      const toRegionId: InnerWorldRegionId | null =
        rIds.length >= 2
          ? (rIds[1] as InnerWorldRegionId)
          : rIds.length === 1
            ? (rIds[0] as InnerWorldRegionId)
            : null;
      return withArchive({
        ...shared,
        eventType: "innerworld-move" as const,
        entityId: eIds[0] as InnerWorldEntityId,
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
