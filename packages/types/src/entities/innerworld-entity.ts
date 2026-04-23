import type {
  HexColor,
  InnerWorldEntityId,
  InnerWorldRegionId,
  MemberId,
  SystemId,
  SystemStructureEntityId,
} from "../ids.js";
import type { ImageSource } from "../image-source.js";
import type { Archived, AuditMetadata } from "../utility.js";

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
