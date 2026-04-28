import { foreignKey, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { brandedId, sqliteJsonOf } from "../../columns/sqlite.js";
import { archivable, timestamps } from "../../helpers/audit.sqlite.js";
import { entityIdentity } from "../../helpers/entity-shape.sqlite.js";

import type {
  HexColor,
  ImageSource,
  MemberId,
  MemberPhotoId,
  SaturationLevel,
  SystemId,
  Tag,
} from "@pluralscape/types";
import type { InferInsertModel, InferSelectModel } from "drizzle-orm";

export const members = sqliteTable("members", {
  ...entityIdentity<MemberId>(),
  name: text("name").notNull(),
  pronouns: sqliteJsonOf<readonly string[]>("pronouns").notNull(),
  description: text("description"),
  avatarSource: sqliteJsonOf<ImageSource | null>("avatar_source"),
  colors: sqliteJsonOf<readonly HexColor[]>("colors").notNull(),
  saturationLevel: sqliteJsonOf<SaturationLevel>("saturation_level").notNull(),
  tags: sqliteJsonOf<readonly Tag[]>("tags").notNull(),
  suppressFriendFrontNotification: integer("suppress_friend_front_notification", {
    mode: "boolean",
  }).notNull(),
  boardMessageNotificationOnFront: integer("board_message_notification_on_front", {
    mode: "boolean",
  }).notNull(),
  ...timestamps(),
  ...archivable(),
});

export const memberPhotos = sqliteTable(
  "member_photos",
  {
    id: brandedId<MemberPhotoId>("id").primaryKey(),
    memberId: brandedId<MemberId>("member_id").notNull(),
    systemId: brandedId<SystemId>("system_id").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    imageSource: sqliteJsonOf<ImageSource>("image_source").notNull(),
    caption: text("caption"),
    ...timestamps(),
    ...archivable(),
  },
  (t) => [
    foreignKey({
      columns: [t.memberId, t.systemId],
      foreignColumns: [members.id, members.systemId],
    }).onDelete("restrict"),
  ],
);

export type LocalMemberRow = InferSelectModel<typeof members>;
export type NewLocalMember = InferInsertModel<typeof members>;
export type LocalMemberPhotoRow = InferSelectModel<typeof memberPhotos>;
export type NewLocalMemberPhoto = InferInsertModel<typeof memberPhotos>;
