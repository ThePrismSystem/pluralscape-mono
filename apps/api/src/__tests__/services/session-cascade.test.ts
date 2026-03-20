/**
 * Structural verification: sessions are CASCADE-deleted when an account is deleted.
 *
 * The accounts table has no active/status column, so there is no "suspended"
 * state to check. Session security relies on:
 * 1. FK cascade: sessions.accountId -> accounts.id ON DELETE CASCADE
 * 2. Session revocation via the revoked boolean
 * 3. Absolute and idle TTL enforcement in validateSession()
 *
 * This test confirms the cascade FK is configured in the schema definition.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

describe("session cascade on account deletion (structural verification)", () => {
  const authSchemaPath = resolve(
    import.meta.dirname,
    "../../../../../packages/db/src/schema/pg/auth.ts",
  );
  const authSchemaSource = readFileSync(authSchemaPath, "utf8");

  it("sessions table references accounts with onDelete cascade", () => {
    // The sessions table's accountId column must have CASCADE delete
    // so that deleting an account automatically removes all its sessions
    expect(authSchemaSource).toContain('.references(() => accounts.id, { onDelete: "cascade" })');
  });

  it("sessions table has accountId as a required field", () => {
    // accountId must be NOT NULL to ensure every session belongs to an account
    expect(authSchemaSource).toContain('accountId: varchar("account_id"');
    // The .notNull() must be chained before .references()
    const sessionBlock = authSchemaSource.slice(authSchemaSource.indexOf("export const sessions"));
    expect(sessionBlock).toContain(".notNull()");
  });
});

describe("session validation checks expiry and revocation", () => {
  const sessionAuthPath = resolve(import.meta.dirname, "../../lib/session-auth.ts");
  const sessionAuthSource = readFileSync(sessionAuthPath, "utf8");

  it("checks revoked status", () => {
    expect(sessionAuthSource).toContain("row.session.revoked");
  });

  it("checks absolute expiry", () => {
    expect(sessionAuthSource).toContain("row.session.expiresAt");
  });

  it("checks idle timeout", () => {
    expect(sessionAuthSource).toContain("idleTimeout");
  });
});
