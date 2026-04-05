import { describe, expect, it } from "vitest";

import { generateFtsStatements, generateSchemaStatements } from "../local-schema.js";

describe("generateSchemaStatements", () => {
  it("generates CREATE TABLE for crdt_documents", () => {
    const stmts = generateSchemaStatements();
    const crdtTable = stmts.find((s) => s.includes("crdt_documents"));
    expect(crdtTable).toBeDefined();
    expect(crdtTable).toContain("document_id TEXT PRIMARY KEY");
    expect(crdtTable).toContain("document_type TEXT NOT NULL");
    expect(crdtTable).toContain("binary BLOB NOT NULL");
    expect(crdtTable).toContain("last_merged_at INTEGER NOT NULL");
  });

  it("generates CREATE TABLE for all entity types", () => {
    const stmts = generateSchemaStatements();
    expect(stmts.some((s) => s.includes("CREATE TABLE") && s.includes("members"))).toBe(true);
    expect(stmts.some((s) => s.includes("CREATE TABLE") && s.includes("fronting_sessions"))).toBe(
      true,
    );
    expect(stmts.some((s) => s.includes("CREATE TABLE") && s.includes("messages"))).toBe(true);
    expect(stmts.some((s) => s.includes("CREATE TABLE") && s.includes("buckets"))).toBe(true);
  });

  it("generates friend_ prefixed tables", () => {
    const stmts = generateSchemaStatements();
    expect(stmts.some((s) => s.includes("CREATE TABLE") && s.includes("friend_members"))).toBe(
      true,
    );
    const friendMembersStmt = stmts.find((s) => s.includes("friend_members"));
    expect(friendMembersStmt).toBeDefined();
    expect(friendMembersStmt).toContain("connection_id TEXT NOT NULL");
  });

  it("does not generate friend_ tables for non-exportable entity types", () => {
    const stmts = generateSchemaStatements();
    expect(stmts.some((s) => s.includes("friend_system_settings"))).toBe(false);
    expect(stmts.some((s) => s.includes("friend_timers"))).toBe(false);
    expect(stmts.some((s) => s.includes("friend_lifecycle_events"))).toBe(false);
  });

  it("crdt_documents is the first statement", () => {
    const stmts = generateSchemaStatements();
    expect(stmts[0]).toContain("crdt_documents");
  });
});

describe("generateFtsStatements", () => {
  it("generates FTS5 virtual tables for entities with ftsColumns", () => {
    const stmts = generateFtsStatements();
    const membersFts = stmts.find((s) => s.includes("fts_members"));
    expect(membersFts).toBeDefined();
    expect(membersFts).toContain("USING fts5");
    expect(membersFts).toContain("name");
    expect(membersFts).toContain("description");
    expect(membersFts).toContain("tokenize='porter unicode61'");
  });

  it("generates INSERT/UPDATE/DELETE triggers for FTS tables", () => {
    const stmts = generateFtsStatements();
    expect(stmts.some((s) => s.includes("TRIGGER members_fts_ai AFTER INSERT"))).toBe(true);
    expect(stmts.some((s) => s.includes("TRIGGER members_fts_ad AFTER DELETE"))).toBe(true);
    expect(stmts.some((s) => s.includes("TRIGGER members_fts_au AFTER UPDATE"))).toBe(true);
  });

  it("generates FTS for friend tables too", () => {
    const stmts = generateFtsStatements();
    expect(stmts.some((s) => s.includes("fts_friend_members"))).toBe(true);
  });

  it("skips FTS for entities with empty ftsColumns", () => {
    const stmts = generateFtsStatements();
    expect(stmts.some((s) => s.includes("fts_system_settings"))).toBe(false);
    expect(stmts.some((s) => s.includes("fts_group_memberships"))).toBe(false);
  });

  it("FTS virtual table references correct content table", () => {
    const stmts = generateFtsStatements();
    const membersFts = stmts.find((s) => s.includes("fts_members") && s.includes("USING fts5"));
    expect(membersFts).toContain("content='members'");
    expect(membersFts).toContain("content_rowid='rowid'");
  });

  it("FTS update trigger deletes old values and inserts new values", () => {
    const stmts = generateFtsStatements();
    const updateTrigger = stmts.find((s) => s.includes("TRIGGER members_fts_au AFTER UPDATE"));
    expect(updateTrigger).toBeDefined();
    expect(updateTrigger).toContain("'delete'");
    expect(updateTrigger).toContain("old.rowid");
    expect(updateTrigger).toContain("new.rowid");
  });
});
