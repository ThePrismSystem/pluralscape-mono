import {
  assertObjectBlob,
  decodeAndDecryptT1,
  encryptInput,
  encryptUpdate,
} from "./decode-blob.js";

import type { KdfMasterKey } from "@pluralscape/crypto";
import type {
  Archived,
  InnerWorldEntityId,
  InnerWorldRegionId,
  MemberId,
  SystemId,
  SystemStructureEntityId,
  UnixMillis,
} from "@pluralscape/types";
import type { InnerWorldEntity, InnerWorldEntityType, VisualProperties } from "@pluralscape/types";

// ── Encrypted payload ─────────────────────────────────────────────────

/** All fields inside the encrypted blob. */
export interface InnerWorldEntityEncryptedPayload {
  readonly entityType: InnerWorldEntityType;
  readonly positionX: number;
  readonly positionY: number;
  readonly visual: VisualProperties;
  // Variant-specific fields — presence depends on entityType
  readonly name?: string;
  readonly description?: string | null;
  readonly linkedMemberId?: MemberId;
  readonly linkedStructureEntityId?: SystemStructureEntityId;
}

// ── Decrypted output — reuse the domain union ─────────────────────────

export type InnerWorldEntityDecrypted = InnerWorldEntity;

// ── Wire types ────────────────────────────────────────────────────────

export interface InnerWorldEntityRaw {
  readonly id: InnerWorldEntityId;
  readonly systemId: SystemId;
  readonly regionId: InnerWorldRegionId | null;
  readonly encryptedData: string;
  readonly archived: boolean;
  readonly archivedAt: UnixMillis | null;
  readonly version: number;
  readonly createdAt: UnixMillis;
  readonly updatedAt: UnixMillis;
}

export interface InnerWorldEntityPage {
  readonly data: readonly InnerWorldEntityRaw[];
  readonly nextCursor: string | null;
}

// ── Validators ────────────────────────────────────────────────────────

function assertInnerWorldEntityPayload(
  raw: unknown,
): asserts raw is InnerWorldEntityEncryptedPayload {
  const obj = assertObjectBlob(raw, "innerworldEntity");
  if (typeof obj["entityType"] !== "string") {
    throw new Error("Decrypted innerworldEntity blob missing required string field: entityType");
  }
}

// ── Transforms ────────────────────────────────────────────────────────

export function decryptInnerWorldEntity(
  raw: InnerWorldEntityRaw,
  masterKey: KdfMasterKey,
): InnerWorldEntityDecrypted | Archived<InnerWorldEntityDecrypted> {
  const plaintext = decodeAndDecryptT1(raw.encryptedData, masterKey);
  assertInnerWorldEntityPayload(plaintext);

  const shared = {
    id: raw.id,
    systemId: raw.systemId,
    regionId: raw.regionId,
    positionX: plaintext.positionX,
    positionY: plaintext.positionY,
    visual: plaintext.visual,
    version: raw.version,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
  };

  let entity: InnerWorldEntityDecrypted;
  switch (plaintext.entityType) {
    case "member":
      entity = {
        ...shared,
        entityType: "member" as const,
        linkedMemberId: plaintext.linkedMemberId as MemberId,
        archived: false as const,
      };
      break;
    case "landmark":
      entity = {
        ...shared,
        entityType: "landmark" as const,
        name: plaintext.name as string,
        description: (plaintext.description as string | null) ?? null,
        archived: false as const,
      };
      break;
    case "structure-entity":
      entity = {
        ...shared,
        entityType: "structure-entity" as const,
        linkedStructureEntityId: plaintext.linkedStructureEntityId as SystemStructureEntityId,
        archived: false as const,
      };
      break;
    default:
      throw new Error(`Unknown innerworld entity type: ${String(plaintext.entityType)}`);
  }

  if (raw.archived) {
    if (raw.archivedAt === null) throw new Error("Archived innerworldEntity missing archivedAt");
    return {
      ...entity,
      archived: true as const,
      archivedAt: raw.archivedAt,
    } as Archived<InnerWorldEntityDecrypted>;
  }
  return entity;
}

export function decryptInnerWorldEntityPage(
  raw: InnerWorldEntityPage,
  masterKey: KdfMasterKey,
): {
  data: (InnerWorldEntityDecrypted | Archived<InnerWorldEntityDecrypted>)[];
  nextCursor: string | null;
} {
  return {
    data: raw.data.map((item) => decryptInnerWorldEntity(item, masterKey)),
    nextCursor: raw.nextCursor,
  };
}

export function encryptInnerWorldEntityInput(
  data: InnerWorldEntityEncryptedPayload,
  masterKey: KdfMasterKey,
): { encryptedData: string } {
  return encryptInput(data, masterKey);
}

export function encryptInnerWorldEntityUpdate(
  data: InnerWorldEntityEncryptedPayload,
  version: number,
  masterKey: KdfMasterKey,
): { encryptedData: string; version: number } {
  return encryptUpdate(data, version, masterKey);
}
