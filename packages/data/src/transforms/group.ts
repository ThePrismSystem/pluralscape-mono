import { GroupEncryptedInputSchema } from "@pluralscape/validation";

import { decodeAndDecryptT1, encryptInput, encryptUpdate } from "./decode-blob.js";

import type { KdfMasterKey } from "@pluralscape/crypto";
import type {
  Group,
  GroupEncryptedFields,
  GroupId,
  HexColor,
  ImageSource,
  SystemId,
  UnixMillis,
} from "@pluralscape/types";

/**
 * Shape passed to `encryptGroupInput()` / `encryptGroupUpdate()` before
 * encryption. Derived from the `Group` domain type by picking the
 * encrypted-field keys — single source of truth lives in
 * `@pluralscape/types`.
 */
export type GroupEncryptedInput = Pick<Group, GroupEncryptedFields>;

// ── Decrypted output type ─────────────────────────────────────────────

/** A fully decrypted group, combining wire metadata with plaintext fields. */
export interface GroupDecrypted {
  readonly id: GroupId;
  readonly systemId: SystemId;
  readonly parentGroupId: GroupId | null;
  readonly sortOrder: number;
  readonly name: string;
  readonly description: string | null;
  readonly imageSource: ImageSource | null;
  readonly color: HexColor | null;
  readonly emoji: string | null;
  readonly archived: boolean;
  readonly archivedAt: UnixMillis | null;
  readonly version: number;
  readonly createdAt: UnixMillis;
  readonly updatedAt: UnixMillis;
}

// ── Wire types (derived from domain types) ──────────────────────────

/** Wire shape returned by `group.get` — derived from `GroupDecrypted`. */
export type GroupRaw = Omit<GroupDecrypted, GroupEncryptedFields> & {
  readonly encryptedData: string;
};

/** Shape returned by `group.list`. */
export interface GroupPage {
  readonly data: readonly GroupRaw[];
  readonly nextCursor: string | null;
}

// ── Group transforms ──────────────────────────────────────────────────

/**
 * Decrypt a single group API result into a `GroupDecrypted`.
 *
 * The encrypted blob contains: `name`, `description`, `imageSource`, `color`, `emoji`.
 * All other fields pass through from the wire payload.
 */
export function decryptGroup(raw: GroupRaw, masterKey: KdfMasterKey): GroupDecrypted {
  const plaintext = decodeAndDecryptT1(raw.encryptedData, masterKey);
  const validated = GroupEncryptedInputSchema.parse(plaintext);
  return {
    id: raw.id,
    systemId: raw.systemId,
    parentGroupId: raw.parentGroupId,
    sortOrder: raw.sortOrder,
    name: validated.name,
    description: validated.description,
    imageSource: validated.imageSource,
    color: validated.color,
    emoji: validated.emoji,
    archived: raw.archived,
    archivedAt: raw.archivedAt,
    version: raw.version,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
  };
}

/**
 * Decrypt a paginated group list result.
 */
export function decryptGroupPage(
  raw: GroupPage,
  masterKey: KdfMasterKey,
): { data: GroupDecrypted[]; nextCursor: string | null } {
  return {
    data: raw.data.map((item) => decryptGroup(item, masterKey)),
    nextCursor: raw.nextCursor,
  };
}

/**
 * Encrypt group plaintext fields for create payloads.
 *
 * Returns `{ encryptedData: string }` — pass the spread of this into
 * `CreateGroupBodySchema`.
 */
export function encryptGroupInput(
  data: GroupEncryptedInput,
  masterKey: KdfMasterKey,
): { encryptedData: string } {
  return encryptInput(data, masterKey);
}

/**
 * Encrypt group plaintext fields for update payloads.
 *
 * Returns `{ encryptedData: string; version: number }` — pass the spread
 * of this into `UpdateGroupBodySchema`.
 */
export function encryptGroupUpdate(
  data: GroupEncryptedInput,
  version: number,
  masterKey: KdfMasterKey,
): { encryptedData: string; version: number } {
  return encryptUpdate(data, version, masterKey);
}
