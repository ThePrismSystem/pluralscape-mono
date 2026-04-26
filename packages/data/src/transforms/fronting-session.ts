import { brandId, toUnixMillis } from "@pluralscape/types";
import { FrontingSessionEncryptedInputSchema } from "@pluralscape/validation";

import { decodeAndDecryptT1, encryptInput, encryptUpdate } from "./decode-blob.js";

import type { KdfMasterKey } from "@pluralscape/crypto";
import type {
  ActiveFrontingSession,
  Archived,
  CompletedFrontingSession,
  CustomFrontId,
  FrontingSession,
  FrontingSessionEncryptedInput,
  FrontingSessionId,
  FrontingSessionWire,
  MemberId,
  SystemId,
  SystemStructureEntityId,
} from "@pluralscape/types";

/** Shape returned by `frontingSession.list`. */
export interface FrontingSessionPage {
  readonly data: readonly FrontingSessionWire[];
  readonly nextCursor: string | null;
}

/**
 * Decrypt a single fronting-session wire object to the canonical domain type.
 * Discriminates on `endTime` to produce `ActiveFrontingSession | CompletedFrontingSession`.
 */
export function decryptFrontingSession(
  raw: FrontingSessionWire,
  masterKey: KdfMasterKey,
): FrontingSession | Archived<FrontingSession> {
  const decrypted = decodeAndDecryptT1(raw.encryptedData, masterKey);
  const validated = FrontingSessionEncryptedInputSchema.parse(decrypted);

  const base = {
    id: brandId<FrontingSessionId>(raw.id),
    systemId: brandId<SystemId>(raw.systemId),
    memberId: raw.memberId === null ? null : brandId<MemberId>(raw.memberId),
    customFrontId: raw.customFrontId === null ? null : brandId<CustomFrontId>(raw.customFrontId),
    structureEntityId:
      raw.structureEntityId === null
        ? null
        : brandId<SystemStructureEntityId>(raw.structureEntityId),
    startTime: toUnixMillis(raw.startTime),
    version: raw.version,
    createdAt: toUnixMillis(raw.createdAt),
    updatedAt: toUnixMillis(raw.updatedAt),
    comment: validated.comment,
    positionality: validated.positionality,
    outtrigger: validated.outtrigger,
    outtriggerSentiment: validated.outtriggerSentiment,
  };

  if (raw.archived) {
    if (raw.archivedAt === null) throw new Error("Archived fronting session missing archivedAt");
    const archivedBase = {
      ...base,
      archived: true as const,
      archivedAt: toUnixMillis(raw.archivedAt),
    };
    if (raw.endTime === null) return { ...archivedBase, endTime: null };
    return { ...archivedBase, endTime: toUnixMillis(raw.endTime) };
  }

  if (raw.endTime === null) {
    return { ...base, archived: false as const, endTime: null } satisfies ActiveFrontingSession;
  }
  return {
    ...base,
    archived: false as const,
    endTime: toUnixMillis(raw.endTime),
  } satisfies CompletedFrontingSession;
}

/** Decrypt a paginated page of fronting sessions from the server. */
export function decryptFrontingSessionPage(
  raw: FrontingSessionPage,
  masterKey: KdfMasterKey,
): { data: (FrontingSession | Archived<FrontingSession>)[]; nextCursor: string | null } {
  return {
    data: raw.data.map((item) => decryptFrontingSession(item, masterKey)),
    nextCursor: raw.nextCursor,
  };
}

export function encryptFrontingSessionInput(
  data: FrontingSessionEncryptedInput,
  masterKey: KdfMasterKey,
): { encryptedData: string } {
  return encryptInput(data, masterKey);
}

export function encryptFrontingSessionUpdate(
  data: FrontingSessionEncryptedInput,
  version: number,
  masterKey: KdfMasterKey,
): { encryptedData: string; version: number } {
  return encryptUpdate(data, version, masterKey);
}
