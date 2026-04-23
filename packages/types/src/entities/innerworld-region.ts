import type { InnerWorldRegionId, MemberId, SystemId } from "../ids.js";
import type { Archived, AuditMetadata } from "../utility.js";
import type { VisualProperties } from "./innerworld-entity.js";

/** A region or area within the innerworld. */
export interface InnerWorldRegion extends AuditMetadata {
  readonly id: InnerWorldRegionId;
  readonly systemId: SystemId;
  readonly name: string;
  readonly description: string | null;
  readonly parentRegionId: InnerWorldRegionId | null;
  readonly visual: VisualProperties;
  readonly boundaryData: readonly { readonly x: number; readonly y: number }[];
  readonly accessType: "open" | "gatekept";
  readonly gatekeeperMemberIds: readonly MemberId[];
  readonly archived: false;
}

/**
 * Keys of `InnerWorldRegion` that are encrypted client-side before the
 * server sees them. `parentRegionId` is a plaintext sibling (server needs
 * it for hierarchy queries) and is intentionally excluded. Consumed by:
 * - `__sot-manifest__.ts` (manifest's `encryptedFields` slot)
 * - `scripts/openapi-wire-parity.type-test.ts` (PlaintextInnerworldRegion parity)
 * - Plan 2 fleet will consume when deriving
 *   `InnerWorldRegionServerMetadata`.
 */
export type InnerWorldRegionEncryptedFields =
  | "name"
  | "description"
  | "visual"
  | "boundaryData"
  | "accessType"
  | "gatekeeperMemberIds";

/** An archived innerworld region. */
export type ArchivedInnerWorldRegion = Archived<InnerWorldRegion>;
