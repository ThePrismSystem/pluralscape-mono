import { SnapshotContentSchema } from "@pluralscape/validation";

import { decodeAndDecryptT1, encryptInput } from "./decode-blob.js";

import type { KdfMasterKey } from "@pluralscape/crypto";
import type {
  SnapshotContent,
  SnapshotTrigger,
  SystemId,
  SystemSnapshotId,
  UnixMillis,
} from "@pluralscape/types";

// ── Decrypted output type ─────────────────────────────────────────────

export interface SnapshotDecrypted {
  readonly id: SystemSnapshotId;
  readonly systemId: SystemId;
  readonly snapshotTrigger: SnapshotTrigger;
  readonly createdAt: UnixMillis;
  readonly content: SnapshotContent;
}

// ── Wire types ────────────────────────────────────────────────────────

export interface SnapshotRaw {
  readonly id: SystemSnapshotId;
  readonly systemId: SystemId;
  readonly snapshotTrigger: SnapshotTrigger;
  readonly createdAt: UnixMillis;
  readonly encryptedData: string;
}

export interface SnapshotPage {
  readonly data: readonly SnapshotRaw[];
  readonly nextCursor: string | null;
}

// ── Transforms ────────────────────────────────────────────────────────

export function decryptSnapshot(raw: SnapshotRaw, masterKey: KdfMasterKey): SnapshotDecrypted {
  const decrypted = decodeAndDecryptT1(raw.encryptedData, masterKey);
  const content = SnapshotContentSchema.parse(decrypted);

  return {
    id: raw.id,
    systemId: raw.systemId,
    snapshotTrigger: raw.snapshotTrigger,
    createdAt: raw.createdAt,
    content,
  };
}

export function decryptSnapshotPage(
  raw: SnapshotPage,
  masterKey: KdfMasterKey,
): { data: SnapshotDecrypted[]; nextCursor: string | null } {
  return {
    data: raw.data.map((item) => decryptSnapshot(item, masterKey)),
    nextCursor: raw.nextCursor,
  };
}

export function encryptSnapshotInput(
  content: SnapshotContent,
  masterKey: KdfMasterKey,
): { encryptedData: string } {
  return encryptInput(content, masterKey);
}
