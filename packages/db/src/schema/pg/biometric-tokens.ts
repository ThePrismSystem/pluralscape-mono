import { index, pgTable, uniqueIndex, varchar } from "drizzle-orm/pg-core";

import { pgTimestamp } from "../../columns/pg.js";
import { ID_MAX_LENGTH } from "../../helpers/db.constants.js";

import { sessions } from "./auth.js";

import type { InferInsertModel, InferSelectModel } from "drizzle-orm";

export const biometricTokens = pgTable(
  "biometric_tokens",
  {
    id: varchar("id", { length: ID_MAX_LENGTH }).primaryKey(),
    sessionId: varchar("session_id", { length: ID_MAX_LENGTH })
      .notNull()
      .references(() => sessions.id, { onDelete: "cascade" }),
    tokenHash: varchar("token_hash", { length: 128 }).notNull(),
    createdAt: pgTimestamp("created_at").notNull(),
    usedAt: pgTimestamp("used_at"),
  },
  (t) => [
    index("biometric_tokens_session_id_idx").on(t.sessionId),
    uniqueIndex("biometric_tokens_token_hash_idx").on(t.tokenHash),
  ],
);

export type BiometricTokenRow = InferSelectModel<typeof biometricTokens>;
export type NewBiometricToken = InferInsertModel<typeof biometricTokens>;
