import { decodeAndDecryptT1, encryptAndEncodeT1 } from "./decode-blob.js";

import type { RouterOutput } from "@pluralscape/api-client/trpc";
import type { KdfMasterKey } from "@pluralscape/crypto";
import type {
  ActiveFrontingSession,
  CompletedFrontingSession,
  FrontingSession,
  OuttriggerSentiment,
} from "@pluralscape/types";

/** The T1-encrypted fields stored inside a fronting session blob. */
export interface FrontingSessionEncryptedFields {
  readonly comment: string | null;
  readonly positionality: string | null;
  readonly outtrigger: string | null;
  readonly outtriggerSentiment: OuttriggerSentiment | null;
}

/** Raw server response shape for a single fronting session. */
type RawFrontingSession = RouterOutput["frontingSession"]["get"];

/** Raw server response shape for a paged fronting session list. */
type RawFrontingSessionPage = RouterOutput["frontingSession"]["list"];

// ── Helpers ──────────────────────────────────────────────────────────────────

function isOuttriggerSentiment(value: unknown): value is OuttriggerSentiment {
  return value === "negative" || value === "neutral" || value === "positive";
}

// ── Validator ────────────────────────────────────────────────────────────────

function assertFrontingSessionEncryptedFields(
  raw: unknown,
): asserts raw is FrontingSessionEncryptedFields {
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
 */
export function decryptFrontingSession(
  raw: RawFrontingSession,
  masterKey: KdfMasterKey,
): FrontingSession {
  const plaintext = decodeAndDecryptT1(raw.encryptedData, masterKey);
  assertFrontingSessionEncryptedFields(plaintext);

  const base = {
    id: raw.id,
    systemId: raw.systemId,
    memberId: raw.memberId,
    customFrontId: raw.customFrontId,
    structureEntityId: raw.structureEntityId,
    startTime: raw.startTime,
    archived: false as const,
    version: raw.version,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
    comment: plaintext.comment ?? null,
    positionality: plaintext.positionality ?? null,
    outtrigger: plaintext.outtrigger ?? null,
    outtriggerSentiment: plaintext.outtriggerSentiment ?? null,
  };

  if (raw.endTime === null) {
    return { ...base, endTime: null } satisfies ActiveFrontingSession;
  }
  return { ...base, endTime: raw.endTime } satisfies CompletedFrontingSession;
}

/**
 * Decrypt a paginated page of fronting sessions from the server.
 */
export function decryptFrontingSessionPage(
  raw: RawFrontingSessionPage,
  masterKey: KdfMasterKey,
): { items: FrontingSession[]; nextCursor: string | null } {
  return {
    items: raw.data.map((item) => decryptFrontingSession(item, masterKey)),
    nextCursor: raw.nextCursor,
  };
}

// ── Encrypt ───────────────────────────────────────────────────────────────────

/**
 * Encrypt fronting session fields for a create mutation.
 * Returns `{ encryptedData }` ready for `frontingSession.create` input.
 */
export function encryptFrontingSessionInput(
  data: FrontingSessionEncryptedFields,
  masterKey: KdfMasterKey,
): { encryptedData: string } {
  return { encryptedData: encryptAndEncodeT1(data, masterKey) };
}

/**
 * Encrypt fronting session fields for an update mutation.
 * Returns `{ encryptedData, version }` ready for `frontingSession.update` input.
 */
export function encryptFrontingSessionUpdate(
  data: FrontingSessionEncryptedFields,
  version: number,
  masterKey: KdfMasterKey,
): { encryptedData: string; version: number } {
  return { encryptedData: encryptAndEncodeT1(data, masterKey), version };
}
