import { brandId, toUnixMillis } from "@pluralscape/types";
import { BoardMessageEncryptedInputSchema } from "@pluralscape/validation";

import { decodeAndDecryptT1, encryptInput, encryptUpdate } from "./decode-blob.js";

import type { KdfMasterKey } from "@pluralscape/crypto";
import type {
  Archived,
  BoardMessage,
  BoardMessageEncryptedInput,
  BoardMessageId,
  BoardMessageWire,
  SystemId,
} from "@pluralscape/types";

/** Shape returned by `boardMessage.list`. */
export interface BoardMessagePage {
  readonly data: readonly BoardMessageWire[];
  readonly nextCursor: string | null;
}

export function decryptBoardMessage(
  raw: BoardMessageWire,
  masterKey: KdfMasterKey,
): BoardMessage | Archived<BoardMessage> {
  const decrypted = decodeAndDecryptT1(raw.encryptedData, masterKey);
  const validated = BoardMessageEncryptedInputSchema.parse(decrypted);

  const base = {
    id: brandId<BoardMessageId>(raw.id),
    systemId: brandId<SystemId>(raw.systemId),
    senderId: validated.senderId,
    content: validated.content,
    pinned: raw.pinned,
    sortOrder: raw.sortOrder,
    version: raw.version,
    createdAt: toUnixMillis(raw.createdAt),
    updatedAt: toUnixMillis(raw.updatedAt),
  };

  if (raw.archived) {
    if (raw.archivedAt === null) throw new Error("Archived board message missing archivedAt");
    return { ...base, archived: true as const, archivedAt: toUnixMillis(raw.archivedAt) };
  }
  return { ...base, archived: false as const };
}

export function decryptBoardMessagePage(
  raw: BoardMessagePage,
  masterKey: KdfMasterKey,
): { data: (BoardMessage | Archived<BoardMessage>)[]; nextCursor: string | null } {
  return {
    data: raw.data.map((item) => decryptBoardMessage(item, masterKey)),
    nextCursor: raw.nextCursor,
  };
}

export function encryptBoardMessageInput(
  data: BoardMessageEncryptedInput,
  masterKey: KdfMasterKey,
): { encryptedData: string } {
  return encryptInput(data, masterKey);
}

export function encryptBoardMessageUpdate(
  data: BoardMessageEncryptedInput,
  version: number,
  masterKey: KdfMasterKey,
): { encryptedData: string; version: number } {
  return encryptUpdate(data, version, masterKey);
}
