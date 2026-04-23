import type { CustomFrontId, HexColor, SystemId } from "../ids.js";
import type { Archived, AuditMetadata } from "../utility.js";

/** A user-defined abstract cognitive state logged like a member. */
export interface CustomFront extends AuditMetadata {
  readonly id: CustomFrontId;
  readonly systemId: SystemId;
  readonly name: string;
  readonly description: string | null;
  readonly color: HexColor | null;
  readonly emoji: string | null;
  readonly archived: false;
}

/** An archived custom front — preserves all data with archive metadata. */
export type ArchivedCustomFront = Archived<CustomFront>;
