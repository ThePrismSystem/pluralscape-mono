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

function decryptFields(
  encryptedData: string,
  masterKey: KdfMasterKey,
): FrontingSessionEncryptedFields {
  const decrypted = decodeAndDecryptT1(encryptedData, masterKey);
  const fields = decrypted as Record<string, unknown>;
  return {
    comment: typeof fields["comment"] === "string" ? fields["comment"] : null,
    positionality: typeof fields["positionality"] === "string" ? fields["positionality"] : null,
    outtrigger: typeof fields["outtrigger"] === "string" ? fields["outtrigger"] : null,
    outtriggerSentiment: isOuttriggerSentiment(fields["outtriggerSentiment"])
      ? fields["outtriggerSentiment"]
      : null,
  };
}

function isOuttriggerSentiment(value: unknown): value is OuttriggerSentiment {
  return value === "negative" || value === "neutral" || value === "positive";
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
  const fields = decryptFields(raw.encryptedData, masterKey);

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
    ...fields,
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
