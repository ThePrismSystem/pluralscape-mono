import {
  assertObjectBlob,
  assertArrayField,
  decodeAndDecryptT1,
  encryptInput,
} from "./decode-blob.js";

import type { KdfMasterKey } from "@pluralscape/crypto";
import type { SystemSnapshotId, SystemId, UnixMillis } from "@pluralscape/types";
import type { SnapshotContent, SnapshotTrigger } from "@pluralscape/types";

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

// ── Validators ────────────────────────────────────────────────────────

function assertSnapshotContent(raw: unknown): asserts raw is SnapshotContent {
  const obj = assertObjectBlob(raw, "snapshot");
  assertArrayField(obj, "snapshot", "members");
  assertArrayField(obj, "snapshot", "groups");
}

// ── Transforms ────────────────────────────────────────────────────────

export function decryptSnapshot(raw: SnapshotRaw, masterKey: KdfMasterKey): SnapshotDecrypted {
  const plaintext = decodeAndDecryptT1(raw.encryptedData, masterKey);
  assertSnapshotContent(plaintext);

  return {
    id: raw.id,
    systemId: raw.systemId,
    snapshotTrigger: raw.snapshotTrigger,
    createdAt: raw.createdAt,
    content: plaintext,
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
