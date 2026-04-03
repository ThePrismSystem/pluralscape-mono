import {
  assertObjectBlob,
  assertStringField,
  decodeAndDecryptT1,
  encryptInput,
  encryptUpdate,
} from "./decode-blob.js";

import type { KdfMasterKey } from "@pluralscape/crypto";
import type { Archived, Channel, ChannelId, SystemId, UnixMillis } from "@pluralscape/types";

// ── Wire types (API response shapes) ─────────────────────────────────

/** Shape returned by `channel.get` and `channel.list` items. */
interface ChannelRaw {
  readonly id: ChannelId;
  readonly systemId: SystemId;
  readonly type: "category" | "channel";
  readonly parentId: ChannelId | null;
  readonly sortOrder: number;
  readonly encryptedData: string;
  readonly version: number;
  readonly archived: boolean;
  readonly archivedAt: UnixMillis | null;
  readonly createdAt: UnixMillis;
  readonly updatedAt: UnixMillis;
}

/** Shape returned by `channel.list`. */
interface ChannelPage {
  readonly data: readonly ChannelRaw[];
  readonly nextCursor: string | null;
}

// ── Encrypted payload types ───────────────────────────────────────────

/**
 * The plaintext fields encrypted inside a channel blob.
 * Pass this to `encryptChannelInput` when creating or updating a channel.
 */
export interface ChannelEncryptedFields {
  readonly name: string;
}

// ── Validators ────────────────────────────────────────────────────────

function assertChannelEncryptedFields(raw: unknown): asserts raw is ChannelEncryptedFields {
  const obj = assertObjectBlob(raw, "channel");
  assertStringField(obj, "channel", "name");
}

// ── Channel transforms ────────────────────────────────────────────────

/**
 * Decrypt a single channel API result into a `Channel`.
 *
 * The encrypted blob contains: `name`.
 * All other fields pass through from the wire payload.
 */
export function decryptChannel(
  raw: ChannelRaw,
  masterKey: KdfMasterKey,
): Channel | Archived<Channel> {
  const plaintext = decodeAndDecryptT1(raw.encryptedData, masterKey);
  assertChannelEncryptedFields(plaintext);

  const base = {
    id: raw.id,
    systemId: raw.systemId,
    name: plaintext.name,
    type: raw.type,
    parentId: raw.parentId,
    sortOrder: raw.sortOrder,
    version: raw.version,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
  };

  if (raw.archived) {
    if (raw.archivedAt === null) throw new Error("Archived channel missing archivedAt");
    return { ...base, archived: true as const, archivedAt: raw.archivedAt };
  }
  return { ...base, archived: false as const };
}

/**
 * Decrypt a paginated channel list result.
 */
export function decryptChannelPage(
  raw: ChannelPage,
  masterKey: KdfMasterKey,
): { data: (Channel | Archived<Channel>)[]; nextCursor: string | null } {
  return {
    data: raw.data.map((item) => decryptChannel(item, masterKey)),
    nextCursor: raw.nextCursor,
  };
}

/**
 * Encrypt channel plaintext fields for create payloads.
 *
 * Returns `{ encryptedData: string }` — pass the spread of this into the
 * `CreateChannelBodySchema`.
 */
export function encryptChannelInput(
  data: ChannelEncryptedFields,
  masterKey: KdfMasterKey,
): { encryptedData: string } {
  return encryptInput(data, masterKey);
}

/**
 * Encrypt channel plaintext fields for update payloads.
 *
 * Returns `{ encryptedData: string; version: number }` — pass the spread of this
 * into the `UpdateChannelBodySchema`.
 */
export function encryptChannelUpdate(
  data: ChannelEncryptedFields,
  version: number,
  masterKey: KdfMasterKey,
): { encryptedData: string; version: number } {
  return encryptUpdate(data, version, masterKey);
}
