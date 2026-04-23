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

/** An archived innerworld region. */
export type ArchivedInnerWorldRegion = Archived<InnerWorldRegion>;
