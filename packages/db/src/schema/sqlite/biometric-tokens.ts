import { sql } from "drizzle-orm";
import { index, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

import { sqliteTimestamp } from "../../columns/sqlite.js";

import { sessions } from "./auth.js";

import type { InferInsertModel, InferSelectModel } from "drizzle-orm";

export const biometricTokens = sqliteTable(
  "biometric_tokens",
  {
    id: text("id").primaryKey(),
    sessionId: text("session_id")
      .notNull()
      .references(() => sessions.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    createdAt: sqliteTimestamp("created_at").notNull(),
    usedAt: sqliteTimestamp("used_at"),
  },
  (t) => [
    index("biometric_tokens_session_id_idx").on(t.sessionId),
    uniqueIndex("biometric_tokens_token_hash_idx").on(t.tokenHash),
    index("biometric_tokens_unused_idx")
      .on(t.tokenHash)
      .where(sql`used_at IS NULL`),
  ],
);

export type BiometricTokenRow = InferSelectModel<typeof biometricTokens>;
export type NewBiometricToken = InferInsertModel<typeof biometricTokens>;
