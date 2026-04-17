import { describe, expect, it } from "vitest";

import { accounts, deviceTransferRequests, sessions } from "../../schema/pg/auth.js";
import { frontingSessions } from "../../schema/pg/fronting.js";
import { friendConnections } from "../../schema/pg/privacy.js";

import { pgTableToCreateDDL, pgTableToIndexDDL } from "./schema-to-ddl.js";

describe("pgTableToCreateDDL", () => {
  it("renders column types, NOT NULL, and defaults", () => {
    const ddl = pgTableToCreateDDL(accounts);
    expect(ddl).toContain("CREATE TABLE");
    expect(ddl).toContain('"accounts"');
    expect(ddl).toContain('"id" varchar(50)');
    expect(ddl).toContain("PRIMARY KEY");
    expect(ddl).toContain('"email_hash" varchar(255) NOT NULL');
    expect(ddl).toContain('"encrypted_master_key" bytea');
    expect(ddl).toContain('"created_at" timestamptz NOT NULL');
    expect(ddl).toContain('"version" integer NOT NULL DEFAULT 1');
    expect(ddl).toContain("DEFAULT 'system'");
  });

  it("produces no $1/$2 placeholders in CHECK constraints", () => {
    const ddl = pgTableToCreateDDL(accounts);
    expect(ddl).not.toMatch(/\$\d+/);
  });

  it("renders enum CHECK constraints with literal values", () => {
    const ddl = pgTableToCreateDDL(accounts);
    expect(ddl).toContain("'system'");
    expect(ddl).toContain("'viewer'");
  });

  it("renders composite primary keys", () => {
    const ddl = pgTableToCreateDDL(frontingSessions);
    expect(ddl).toContain('PRIMARY KEY ("id", "start_time")');
    // 'id' column should NOT have inline PRIMARY KEY since it's composite
    expect(ddl).not.toMatch(/"id" varchar\(50\) NOT NULL PRIMARY KEY/);
  });

  it("renders foreign keys with ON DELETE", () => {
    const ddl = pgTableToCreateDDL(deviceTransferRequests);
    expect(ddl).toContain('REFERENCES "accounts"("id") ON DELETE CASCADE');
    expect(ddl).toContain('REFERENCES "sessions"("id") ON DELETE CASCADE');
  });

  it("renders composite foreign keys", () => {
    const ddl = pgTableToCreateDDL(frontingSessions);
    expect(ddl).toContain(
      'FOREIGN KEY ("member_id", "system_id") REFERENCES "members"("id", "system_id")',
    );
  });

  it("renders UNIQUE constraints", () => {
    const ddl = pgTableToCreateDDL(friendConnections);
    expect(ddl).toContain('UNIQUE ("id", "account_id")');
  });

  it("renders CHECK constraints for non-enum rules", () => {
    const ddl = pgTableToCreateDDL(friendConnections);
    // no self-friend check
    expect(ddl).toContain('"account_id" !=');
    expect(ddl).toContain('"friend_account_id"');
  });
});

describe("pgTableToIndexDDL", () => {
  it("renders simple indexes", () => {
    const indexes = pgTableToIndexDDL(accounts);
    expect(indexes.some((s) => s.includes("accounts_email_hash_idx"))).toBe(true);
  });

  it("renders unique indexes", () => {
    const indexes = pgTableToIndexDDL(accounts);
    const emailIdx = indexes.find((s) => s.includes("accounts_email_hash_idx"));
    expect(emailIdx).toContain("CREATE UNIQUE INDEX");
  });

  it("renders WHERE clause on partial indexes", () => {
    const indexes = pgTableToIndexDDL(sessions);
    const expiresIdx = indexes.find((s) => s.includes("sessions_expires_at_idx"));
    expect(expiresIdx).toContain("WHERE");
    expect(expiresIdx).toContain("IS NOT NULL");
  });

  it("renders partial unique indexes", () => {
    const indexes = pgTableToIndexDDL(friendConnections);
    const uniqIdx = indexes.find((s) => s.includes("friend_connections_account_friend_uniq"));
    expect(uniqIdx).toContain("CREATE UNIQUE INDEX");
    expect(uniqIdx).toContain("WHERE");
  });

  it("produces no $1/$2 placeholders in index definitions", () => {
    const allIndexes = [
      ...pgTableToIndexDDL(accounts),
      ...pgTableToIndexDDL(sessions),
      ...pgTableToIndexDDL(friendConnections),
    ];
    for (const idx of allIndexes) {
      expect(idx).not.toMatch(/\$\d+/);
    }
  });
});
