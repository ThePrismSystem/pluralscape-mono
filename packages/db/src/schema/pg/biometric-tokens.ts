import { sql } from "drizzle-orm";
import { index, pgTable, uniqueIndex, varchar } from "drizzle-orm/pg-core";

import { brandedId, pgTimestamp } from "../../columns/pg.js";

import { sessions } from "./auth.js";

import type { BiometricTokenId, SessionId } from "@pluralscape/types";
import type { InferInsertModel, InferSelectModel } from "drizzle-orm";

export const biometricTokens = pgTable(
  "biometric_tokens",
  {
    id: brandedId<BiometricTokenId>("id").primaryKey(),
    sessionId: brandedId<SessionId>("session_id")
      .notNull()
      .references(() => sessions.id, { onDelete: "cascade" }),
    tokenHash: varchar("token_hash", { length: 128 }).notNull(),
    createdAt: pgTimestamp("created_at").notNull(),
    usedAt: pgTimestamp("used_at"),
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
