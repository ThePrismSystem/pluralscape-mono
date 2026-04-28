import { foreignKey, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { brandedId, sqliteTimestamp } from "../../columns/sqlite.js";
import { archivable, timestamps } from "../../helpers/audit.sqlite.js";
import { entityIdentity } from "../../helpers/entity-shape.sqlite.js";

import type {
  CustomFrontId,
  FrontingCommentId,
  FrontingSessionId,
  HexColor,
  MemberId,
  OuttriggerSentiment,
  SystemStructureEntityId,
} from "@pluralscape/types";
import type { InferInsertModel, InferSelectModel } from "drizzle-orm";

/**
 * Decrypted client-cache projection of `CustomFront`. Mirrors the
 * `CustomFront` domain type from `@pluralscape/types`.
 */
export const customFronts = sqliteTable("custom_fronts", {
  ...entityIdentity<CustomFrontId>(),
  name: text("name").notNull(),
  description: text("description"),
  color: text("color").$type<HexColor | null>(),
  emoji: text("emoji"),
  ...timestamps(),
  ...archivable(),
});

/**
 * Decrypted client-cache projection of `FrontingSession`. The session is a
 * discriminated union on `endTime` (null = active); the cache schema stores
 * both shapes via the nullable `endTime` column.
 */
export const frontingSessions = sqliteTable(
  "fronting_sessions",
  {
    ...entityIdentity<FrontingSessionId>(),
    memberId: brandedId<MemberId>("member_id"),
    customFrontId: brandedId<CustomFrontId>("custom_front_id"),
    structureEntityId: brandedId<SystemStructureEntityId>("structure_entity_id"),
    startTime: sqliteTimestamp("start_time").notNull(),
    endTime: sqliteTimestamp("end_time"),
    comment: text("comment"),
    positionality: text("positionality"),
    outtrigger: text("outtrigger"),
    outtriggerSentiment: text("outtrigger_sentiment").$type<OuttriggerSentiment | null>(),
    ...timestamps(),
    ...archivable(),
  },
  (t) => [
    foreignKey({
      columns: [t.customFrontId],
      foreignColumns: [customFronts.id],
    }).onDelete("restrict"),
  ],
);

/**
 * Decrypted client-cache projection of `FrontingComment`. Mirrors the
 * `FrontingComment` domain type.
 */
export const frontingComments = sqliteTable("fronting_comments", {
  ...entityIdentity<FrontingCommentId>(),
  frontingSessionId: brandedId<FrontingSessionId>("fronting_session_id").notNull(),
  memberId: brandedId<MemberId>("member_id"),
  customFrontId: brandedId<CustomFrontId>("custom_front_id"),
  structureEntityId: brandedId<SystemStructureEntityId>("structure_entity_id"),
  content: text("content").notNull(),
  ...timestamps(),
  ...archivable(),
});

export type LocalCustomFrontRow = InferSelectModel<typeof customFronts>;
export type NewLocalCustomFront = InferInsertModel<typeof customFronts>;
export type LocalFrontingSessionRow = InferSelectModel<typeof frontingSessions>;
export type NewLocalFrontingSession = InferInsertModel<typeof frontingSessions>;
export type LocalFrontingCommentRow = InferSelectModel<typeof frontingComments>;
export type NewLocalFrontingComment = InferInsertModel<typeof frontingComments>;
