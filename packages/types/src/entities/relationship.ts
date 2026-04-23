import type { MemberId, RelationshipId, SystemId } from "../ids.js";
import type { UnixMillis } from "../timestamps.js";
import type { Archived } from "../utility.js";

/** The kind of relationship between two members. */
export type RelationshipType =
  | "split-from"
  | "fused-from"
  | "sibling"
  | "partner"
  | "parent-child"
  | "protector-of"
  | "caretaker-of"
  | "gatekeeper-of"
  | "source"
  | "custom";

/** A relationship between two members. */
export interface Relationship {
  readonly id: RelationshipId;
  readonly systemId: SystemId;
  readonly sourceMemberId: MemberId | null;
  readonly targetMemberId: MemberId | null;
  readonly type: RelationshipType;
  /** User-defined label — only meaningful when type is "custom". */
  readonly label: string | null;
  readonly bidirectional: boolean;
  readonly createdAt: UnixMillis;
  readonly archived: false;
}

export type ArchivedRelationship = Archived<Relationship>;
