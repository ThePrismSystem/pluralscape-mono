import type {
  HexColor,
  InnerWorldEntityId,
  InnerWorldRegionId,
  LayerId,
  MemberId,
  SideSystemId,
  SubsystemId,
  SystemId,
} from "./ids.js";
import type { ImageSource } from "./image-source.js";
import type { AuditMetadata } from "./utility.js";

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

/** An innerworld entity representing a subsystem. */
export interface SubsystemEntity extends InnerWorldEntityBase {
  readonly entityType: "subsystem";
  readonly linkedSubsystemId: SubsystemId;
}

/** An innerworld entity representing a side system. */
export interface SideSystemEntity extends InnerWorldEntityBase {
  readonly entityType: "side-system";
  readonly linkedSideSystemId: SideSystemId;
}

/** An innerworld entity representing a layer. */
export interface LayerEntity extends InnerWorldEntityBase {
  readonly entityType: "layer";
  readonly linkedLayerId: LayerId;
}

/** All innerworld entity variants — discriminated on entityType. */
export type InnerWorldEntity =
  | MemberEntity
  | LandmarkEntity
  | SubsystemEntity
  | SideSystemEntity
  | LayerEntity;

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
}

/** The viewport state for the innerworld canvas. */
export interface InnerWorldCanvas {
  readonly systemId: SystemId;
  readonly viewportX: number;
  readonly viewportY: number;
  readonly zoom: number;
  readonly dimensions: { readonly width: number; readonly height: number };
}
