import type {
  HexColor,
  InnerWorldEntityId,
  InnerWorldRegionId,
  MemberId,
  SystemId,
  SystemStructureEntityId,
} from "./ids.js";
import type { ImageSource } from "./image-source.js";
import type { Archived, AuditMetadata } from "./utility.js";

/** Visual styling properties for innerworld entities. */
export interface VisualProperties {
  readonly color: HexColor | null;
  readonly icon: string | null;
  readonly size: number | null;
  readonly opacity: number | null;
  readonly imageSource: ImageSource | null;
  readonly externalUrl: string | null;
}

// ── Entity types (discriminated union) ─────────────────────────────

/** Shared base fields for all innerworld entities (unexported). */
interface InnerWorldEntityBase extends AuditMetadata {
  readonly id: InnerWorldEntityId;
  readonly systemId: SystemId;
  readonly positionX: number;
  readonly positionY: number;
  readonly visual: VisualProperties;
  readonly regionId: InnerWorldRegionId | null;
  readonly archived: false;
}

/** An innerworld entity representing a member's presence. */
export interface MemberEntity extends InnerWorldEntityBase {
  readonly entityType: "member";
  readonly linkedMemberId: MemberId;
}

/** An innerworld entity representing a landmark or location. */
export interface LandmarkEntity extends InnerWorldEntityBase {
  readonly entityType: "landmark";
  readonly name: string;
  readonly description: string | null;
}

/** Linked to a system structure entity. */
export interface StructureEntityEntity extends InnerWorldEntityBase {
  readonly entityType: "structure-entity";
  readonly linkedStructureEntityId: SystemStructureEntityId;
}

/** All innerworld entity variants — discriminated on entityType. */
export type InnerWorldEntity = MemberEntity | LandmarkEntity | StructureEntityEntity;

/** An archived innerworld entity. */
export type ArchivedInnerWorldEntity = Archived<InnerWorldEntity>;

/** The set of valid innerworld entity type strings. */
export type InnerWorldEntityType = InnerWorldEntity["entityType"];

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

/** The viewport state for the innerworld canvas. */
export interface InnerWorldCanvas {
  readonly systemId: SystemId;
  readonly viewportX: number;
  readonly viewportY: number;
  readonly zoom: number;
  readonly dimensions: { readonly width: number; readonly height: number };
}
