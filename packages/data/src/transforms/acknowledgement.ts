import { brandId, toUnixMillis } from "@pluralscape/types";
import { AcknowledgementRequestEncryptedInputSchema } from "@pluralscape/validation";

import { decodeAndDecryptT1, encryptInput, encryptUpdate } from "./decode-blob.js";

import type { KdfMasterKey } from "@pluralscape/crypto";
import type {
  AcknowledgementId,
  AcknowledgementRequest,
  AcknowledgementRequestEncryptedInput,
  AcknowledgementRequestWire,
  Archived,
  MemberId,
  SystemId,
} from "@pluralscape/types";

/** Shape returned by `acknowledgement.list`. */
export interface AcknowledgementPage {
  readonly data: readonly AcknowledgementRequestWire[];
  readonly nextCursor: string | null;
}

export function decryptAcknowledgement(
  raw: AcknowledgementRequestWire,
  masterKey: KdfMasterKey,
): AcknowledgementRequest | Archived<AcknowledgementRequest> {
  const decrypted = decodeAndDecryptT1(raw.encryptedData, masterKey);
  const validated = AcknowledgementRequestEncryptedInputSchema.parse(decrypted);

  if (raw.createdByMemberId === null) {
    // Canonical AcknowledgementRequest requires a non-null creator; the server
    // row is nullable only to accommodate legacy imports without an originating
    // member, which the API contract still owes us a follow-up rejection for.
    throw new Error("Acknowledgement missing createdByMemberId");
  }

  const base = {
    id: brandId<AcknowledgementId>(raw.id),
    systemId: brandId<SystemId>(raw.systemId),
    createdByMemberId: brandId<MemberId>(raw.createdByMemberId),
    targetMemberId: validated.targetMemberId,
    message: validated.message,
    confirmed: raw.confirmed,
    confirmedAt: validated.confirmedAt === null ? null : toUnixMillis(validated.confirmedAt),
    version: raw.version,
    createdAt: toUnixMillis(raw.createdAt),
    updatedAt: toUnixMillis(raw.updatedAt),
  };

  if (raw.archived) {
    if (raw.archivedAt === null) throw new Error("Archived acknowledgement missing archivedAt");
    return { ...base, archived: true as const, archivedAt: toUnixMillis(raw.archivedAt) };
  }
  return { ...base, archived: false as const };
}

export function decryptAcknowledgementPage(
  raw: AcknowledgementPage,
  masterKey: KdfMasterKey,
): {
  data: (AcknowledgementRequest | Archived<AcknowledgementRequest>)[];
  nextCursor: string | null;
} {
  return {
    data: raw.data.map((item) => decryptAcknowledgement(item, masterKey)),
    nextCursor: raw.nextCursor,
  };
}

export function encryptAcknowledgementInput(
  data: AcknowledgementRequestEncryptedInput,
  masterKey: KdfMasterKey,
): { encryptedData: string } {
  return encryptInput(data, masterKey);
}

export function encryptAcknowledgementUpdate(
  data: AcknowledgementRequestEncryptedInput,
  version: number,
  masterKey: KdfMasterKey,
): { encryptedData: string; version: number } {
  return encryptUpdate(data, version, masterKey);
}

export function encryptAcknowledgementConfirm(
  data: AcknowledgementRequestEncryptedInput,
  masterKey: KdfMasterKey,
): { encryptedData: string } {
  return encryptInput(data, masterKey);
}
