import type { ChannelId, SystemId } from "../ids.js";
import type { Archived, AuditMetadata } from "../utility.js";

/** A communication channel or category within a system. */
export interface Channel extends AuditMetadata {
  readonly id: ChannelId;
  readonly systemId: SystemId;
  readonly name: string;
  readonly type: "category" | "channel";
  /** Parent category ID. Null for categories and uncategorized channels. */
  readonly parentId: ChannelId | null;
  readonly sortOrder: number;
  readonly archived: false;
}

/** An archived channel. */
export type ArchivedChannel = Archived<Channel>;
