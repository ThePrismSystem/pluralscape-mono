import { describe, expect, it, vi } from "vitest";

import type { SystemId } from "@pluralscape/types";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

// ── Import under test ────────────────────────────────────────────────

const { validateSubjectIds } = await import("../../lib/validate-subject-ids.js");

// ── Fixtures ─────────────────────────────────────────────────────────

const SYSTEM_ID = "sys_550e8400-e29b-41d4-a716-446655440000" as SystemId;

function createMockTx(queryResult: Array<{ id: string } | undefined>): PostgresJsDatabase {
  let callIndex = 0;
  const mockLimit = vi.fn().mockImplementation(() => {
    const result = queryResult[callIndex];
    callIndex++;
    return result ? [result] : [];
  });
  const mockWhere = vi.fn().mockReturnValue({ limit: mockLimit });
  const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
  const mockSelect = vi.fn().mockReturnValue({ from: mockFrom });

  return { select: mockSelect } as never;
}

// ── Tests ─────────────────────────────────────────────────────────────

describe("validateSubjectIds", () => {
  it("does nothing when no subject IDs are provided", async () => {
    const tx = createMockTx([]);
    await expect(validateSubjectIds(tx, SYSTEM_ID, {})).resolves.toBeUndefined();
  });

  it("does nothing when subject IDs are null", async () => {
    const tx = createMockTx([]);
    await expect(
      validateSubjectIds(tx, SYSTEM_ID, {
        memberId: null,
        customFrontId: null,
        structureEntityId: null,
      }),
    ).resolves.toBeUndefined();
  });

  it("passes when memberId exists and is not archived", async () => {
    const tx = createMockTx([{ id: "mem_test" }]);
    await expect(
      validateSubjectIds(tx, SYSTEM_ID, {
        memberId: "mem_test",
      }),
    ).resolves.toBeUndefined();
  });

  it("throws INVALID_SUBJECT when memberId not found", async () => {
    const tx = createMockTx([undefined]);
    await expect(
      validateSubjectIds(tx, SYSTEM_ID, { memberId: "mem_nonexistent" }),
    ).rejects.toThrow(
      expect.objectContaining({
        status: 400,
        code: "INVALID_SUBJECT",
      }),
    );
  });

  it("throws INVALID_SUBJECT when memberId is archived (filtered out by query)", async () => {
    // An archived member won't be returned by the query because of the archived=false filter
    const tx = createMockTx([undefined]);
    await expect(validateSubjectIds(tx, SYSTEM_ID, { memberId: "mem_archived" })).rejects.toThrow(
      expect.objectContaining({
        status: 400,
        code: "INVALID_SUBJECT",
      }),
    );
  });

  it("passes when customFrontId exists and is not archived", async () => {
    const tx = createMockTx([{ id: "cf_test" }]);
    await expect(
      validateSubjectIds(tx, SYSTEM_ID, { customFrontId: "cf_test" }),
    ).resolves.toBeUndefined();
  });

  it("throws INVALID_SUBJECT when customFrontId not found", async () => {
    const tx = createMockTx([undefined]);
    await expect(
      validateSubjectIds(tx, SYSTEM_ID, { customFrontId: "cf_nonexistent" }),
    ).rejects.toThrow(
      expect.objectContaining({
        status: 400,
        code: "INVALID_SUBJECT",
      }),
    );
  });

  it("passes when structureEntityId exists and is not archived", async () => {
    const tx = createMockTx([{ id: "ste_test" }]);
    await expect(
      validateSubjectIds(tx, SYSTEM_ID, { structureEntityId: "ste_test" }),
    ).resolves.toBeUndefined();
  });

  it("throws INVALID_SUBJECT when structureEntityId not found", async () => {
    const tx = createMockTx([undefined]);
    await expect(
      validateSubjectIds(tx, SYSTEM_ID, { structureEntityId: "ste_nonexistent" }),
    ).rejects.toThrow(
      expect.objectContaining({
        status: 400,
        code: "INVALID_SUBJECT",
      }),
    );
  });

  it("validates all provided subject IDs in sequence", async () => {
    const tx = createMockTx([{ id: "mem_test" }, { id: "cf_test" }, { id: "ste_test" }]);
    await expect(
      validateSubjectIds(tx, SYSTEM_ID, {
        memberId: "mem_test",
        customFrontId: "cf_test",
        structureEntityId: "ste_test",
      }),
    ).resolves.toBeUndefined();
  });

  it("throws on first invalid subject when multiple provided", async () => {
    const tx = createMockTx([{ id: "mem_test" }, undefined]);
    await expect(
      validateSubjectIds(tx, SYSTEM_ID, {
        memberId: "mem_test",
        customFrontId: "cf_invalid",
        structureEntityId: "ste_test",
      }),
    ).rejects.toThrow(
      expect.objectContaining({
        status: 400,
        code: "INVALID_SUBJECT",
        message: expect.stringContaining("Custom front"),
      }),
    );
  });
});
