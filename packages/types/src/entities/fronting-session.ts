import type { EncryptedWire } from "../encrypted-wire.js";
import type { EncryptedBlob } from "../encryption-primitives.js";
import type {
  CustomFrontId,
  FrontingSessionId,
  MemberId,
  SystemId,
  SystemStructureEntityId,
} from "../ids.js";
import type { UnixMillis } from "../timestamps.js";
import type { Serialize } from "../type-assertions.js";
import type { Archived, AuditMetadata } from "../utility.js";

/** Sentiment classification for an outtrigger reason. */
export type OuttriggerSentiment = "negative" | "neutral" | "positive";

/** Shared fields for all fronting session variants. */
interface FrontingSessionBase extends AuditMetadata {
  readonly id: FrontingSessionId;
  readonly systemId: SystemId;
  readonly memberId: MemberId | null;
  readonly startTime: UnixMillis;
  /** Free-text status comment on this session. Max 50 characters (runtime enforced). SP-compatible. */
  readonly comment: string | null;
  readonly customFrontId: CustomFrontId | null;
  /** FK to linked structure entity. */
  readonly structureEntityId: SystemStructureEntityId | null;
  /** Free-text description of fronting positionality (e.g. close vs far, height). */
  readonly positionality: string | null;
  /** Free-text reason describing what caused the fronting change. Stored in T1 encrypted blob. */
  readonly outtrigger: string | null;
  /** Sentiment classification for the outtrigger reason. Stored in T1 encrypted blob. */
  readonly outtriggerSentiment: OuttriggerSentiment | null;
  readonly archived: false;
}

/** A fronting session that is still active (no end time). */
export interface ActiveFrontingSession extends FrontingSessionBase {
  readonly endTime: null;
}

/** A fronting session that has ended. */
export interface CompletedFrontingSession extends FrontingSessionBase {
  readonly endTime: UnixMillis;
}

/** A fronting session — discriminated on `endTime` (null = active). */
export type FrontingSession = ActiveFrontingSession | CompletedFrontingSession;

/**
 * Keys of `FrontingSession` that are encrypted client-side before the
 * server sees them. Plaintext siblings (`memberId`, `customFrontId`,
 * `structureEntityId`, `startTime`, `endTime`) travel as separate request
 * fields and are intentionally excluded. Consumed by:
 * - `__sot-manifest__.ts` (manifest's `encryptedFields` slot)
 * - `scripts/openapi-wire-parity.type-test.ts` (PlaintextFrontingSession parity)
 * - Plan 2 fleet will consume when deriving
 *   `FrontingSessionServerMetadata`.
 */
export type FrontingSessionEncryptedFields =
  | "comment"
  | "positionality"
  | "outtrigger"
  | "outtriggerSentiment";

/**
 * Pre-encryption shape — what `encryptFrontingSessionInput` accepts. Single source
 * of truth: derived from `FrontingSession` via `Pick<>` over the encrypted-keys union.
 */
export type FrontingSessionEncryptedInput = Pick<FrontingSession, FrontingSessionEncryptedFields>;

/** An archived fronting session. */
export type ArchivedFrontingSession = Archived<FrontingSession>;

/** Computed snapshot of the current co-fronting state. Not persisted. */
export interface CoFrontState {
  readonly timestamp: UnixMillis;
  readonly activeSessions: readonly ActiveFrontingSession[];
}

/**
 * Server-visible FrontingSession metadata — raw Drizzle row shape.
 *
 * Derived from the `FrontingSession` discriminated union by stripping the
 * encrypted field keys (bundled inside `encryptedData`), `archived` (the
 * domain uses a `false` literal while the server tracks a mutable boolean
 * with a companion `archivedAt` timestamp), and `endTime` (replaced below
 * with a single nullable column — both union variants collapse to the
 * same shape after stripping those keys). Adds `archived`/`archivedAt`
 * and the encrypted blob.
 *
 * The underlying table is partitioned by `startTime` (ADR 019) — see
 * `packages/db/src/schema/pg/fronting.ts`.
 */
export type FrontingSessionServerMetadata = Omit<
  FrontingSession,
  FrontingSessionEncryptedFields | "archived" | "endTime"
> & {
  readonly endTime: UnixMillis | null;
  readonly archived: boolean;
  readonly archivedAt: UnixMillis | null;
  readonly encryptedData: EncryptedBlob;
};

/**
 * Server-emit shape — what `toFrontingSessionResult` returns. Branded IDs and
 * timestamps preserved; `encryptedData` is wire-form `EncryptedBase64`.
 */
export type FrontingSessionResult = EncryptedWire<FrontingSessionServerMetadata>;

/**
 * JSON-serialized wire form of `FrontingSessionResult`: branded IDs become plain strings;
 * `EncryptedBase64` becomes plain `string`; timestamps become numbers.
 */
export type FrontingSessionWire = Serialize<FrontingSessionResult>;
