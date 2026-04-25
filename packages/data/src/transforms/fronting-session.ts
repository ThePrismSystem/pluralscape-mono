import { decodeAndDecryptT1, encryptInput, encryptUpdate } from "./decode-blob.js";

import type { KdfMasterKey } from "@pluralscape/crypto";
import type {
  ActiveFrontingSession,
  Archived,
  CompletedFrontingSession,
  EncryptedBase64,
  FrontingSession,
  FrontingSessionEncryptedFields,
  OuttriggerSentiment,
  PlaintextFields,
  UnixMillis,
} from "@pluralscape/types";

/**
 * The T1-encrypted plaintext payload for a fronting session.
 * Derived from `FrontingSession` by picking its encrypted-field keys —
 * SoT lives in `@pluralscape/types`.
 */
export type FrontingSessionPlaintext = PlaintextFields<
  FrontingSession,
  FrontingSessionEncryptedFields
>;

// ── Wire types (derived from domain types) ──────────────────────────

/** Wire shape for a single fronting session — derived from `ActiveFrontingSession`. */
export type FrontingSessionRaw = Omit<
  ActiveFrontingSession,
  FrontingSessionEncryptedFields | "archived" | "endTime"
> & {
  readonly endTime: UnixMillis | null;
  readonly encryptedData: EncryptedBase64;
  readonly archived: boolean;
  readonly archivedAt: UnixMillis | null;
};

/** Shape returned by `frontingSession.list`. */
export interface FrontingSessionPage {
  readonly data: readonly FrontingSessionRaw[];
  readonly nextCursor: string | null;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function isOuttriggerSentiment(value: unknown): value is OuttriggerSentiment {
  return value === "negative" || value === "neutral" || value === "positive";
}

// ── Validator ────────────────────────────────────────────────────────────────

function assertFrontingSessionPlaintext(raw: unknown): asserts raw is FrontingSessionPlaintext {
  if (raw === null || typeof raw !== "object") {
    throw new Error("Decrypted fronting session blob is not an object");
  }
  const obj = raw as Record<string, unknown>;
  if (obj["comment"] !== null && typeof obj["comment"] !== "string") {
    throw new Error("Decrypted fronting session blob: comment must be string or null");
  }
  if (obj["positionality"] !== null && typeof obj["positionality"] !== "string") {
    throw new Error("Decrypted fronting session blob: positionality must be string or null");
  }
  if (obj["outtrigger"] !== null && typeof obj["outtrigger"] !== "string") {
    throw new Error("Decrypted fronting session blob: outtrigger must be string or null");
  }
  if (obj["outtriggerSentiment"] !== null && !isOuttriggerSentiment(obj["outtriggerSentiment"])) {
    throw new Error(
      "Decrypted fronting session blob: outtriggerSentiment must be a valid sentiment or null",
    );
  }
}

// ── Decrypt ───────────────────────────────────────────────────────────────────

/**
 * Decrypt a raw fronting session from the server into a typed `FrontingSession`.
 * Discriminates on `endTime` to produce `ActiveFrontingSession | CompletedFrontingSession`.
 * Returns the archived variant when `raw.archived` is true.
 */
export function decryptFrontingSession(
  raw: FrontingSessionRaw,
  masterKey: KdfMasterKey,
): FrontingSession | Archived<FrontingSession> {
  const plaintext = decodeAndDecryptT1(raw.encryptedData, masterKey);
  assertFrontingSessionPlaintext(plaintext);

  const base = {
    id: raw.id,
    systemId: raw.systemId,
    memberId: raw.memberId,
    customFrontId: raw.customFrontId,
    structureEntityId: raw.structureEntityId,
    startTime: raw.startTime,
    version: raw.version,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
    comment: plaintext.comment ?? null,
    positionality: plaintext.positionality ?? null,
    outtrigger: plaintext.outtrigger ?? null,
    outtriggerSentiment: plaintext.outtriggerSentiment ?? null,
  };

  if (raw.archived) {
    if (raw.archivedAt === null) throw new Error("Archived fronting session missing archivedAt");
    const archivedBase = { ...base, archived: true as const, archivedAt: raw.archivedAt };
    if (raw.endTime === null) return { ...archivedBase, endTime: null };
    return { ...archivedBase, endTime: raw.endTime };
  }

  if (raw.endTime === null) {
    return { ...base, archived: false as const, endTime: null } satisfies ActiveFrontingSession;
  }
  return {
    ...base,
    archived: false as const,
    endTime: raw.endTime,
  } satisfies CompletedFrontingSession;
}

/**
 * Decrypt a paginated page of fronting sessions from the server.
 */
export function decryptFrontingSessionPage(
  raw: FrontingSessionPage,
  masterKey: KdfMasterKey,
): { data: (FrontingSession | Archived<FrontingSession>)[]; nextCursor: string | null } {
  return {
    data: raw.data.map((item) => decryptFrontingSession(item, masterKey)),
    nextCursor: raw.nextCursor,
  };
}

// ── Encrypt ───────────────────────────────────────────────────────────────────

/**
 * Encrypt fronting session fields for a create mutation.
 * Returns `{ encryptedData }` ready for `frontingSession.create` input.
 */
export function encryptFrontingSessionInput(
  data: FrontingSessionPlaintext,
  masterKey: KdfMasterKey,
): { encryptedData: string } {
  return encryptInput(data, masterKey);
}

/**
 * Encrypt fronting session fields for an update mutation.
 * Returns `{ encryptedData, version }` ready for `frontingSession.update` input.
 */
export function encryptFrontingSessionUpdate(
  data: FrontingSessionPlaintext,
  version: number,
  masterKey: KdfMasterKey,
): { encryptedData: string; version: number } {
  return encryptUpdate(data, version, masterKey);
}
