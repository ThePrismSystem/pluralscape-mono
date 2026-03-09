import type { InnerWorldEntityId, InnerWorldRegionId, MemberId, SystemId } from "./ids.js";
import type { AuditMetadata } from "./utility.js";

/** Visual styling properties for innerworld entities. */
export interface VisualProperties {
  readonly color: string | null;
  readonly icon: string | null;
  readonly size: number | null;
  readonly opacity: number | null;
}

/** An innerworld entity representing a member's presence. */
export interface MemberEntity {
  readonly kind: "member";
  readonly memberId: MemberId;
}

/** An innerworld entity representing a landmark or location. */
export interface LandmarkEntity {
  readonly kind: "landmark";
  readonly label: string;
  readonly description: string | null;
}

/** Discriminated union of innerworld entity data. */
export type InnerWorldEntityData = MemberEntity | LandmarkEntity;

/** An entity placed in the system's innerworld. */
export interface InnerWorldEntity extends AuditMetadata {
  readonly id: InnerWorldEntityId;
  readonly systemId: SystemId;
  readonly regionId: InnerWorldRegionId | null;
  readonly name: string;
  readonly data: InnerWorldEntityData;
  readonly visual: VisualProperties;
  readonly x: number;
  readonly y: number;
}

/** A region or area within the innerworld. */
export interface InnerWorldRegion extends AuditMetadata {
  readonly id: InnerWorldRegionId;
  readonly systemId: SystemId;
  readonly name: string;
  readonly description: string | null;
  readonly parentRegionId: InnerWorldRegionId | null;
  readonly visual: VisualProperties;
}

/** The full canvas state for the innerworld view. */
export interface InnerWorldCanvas {
  readonly systemId: SystemId;
  readonly entities: readonly InnerWorldEntity[];
  readonly regions: readonly InnerWorldRegion[];
}
