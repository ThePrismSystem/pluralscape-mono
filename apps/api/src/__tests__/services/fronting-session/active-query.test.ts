import { brandId } from "@pluralscape/types";
import { afterEach, describe, expect, it, vi } from "vitest";

import { mockDb } from "../../helpers/mock-db.js";

import { AUTH, CF_ID, SE_ID, SYSTEM_ID, makeFSRow } from "./internal.js";

import type { SystemStructureEntityId } from "@pluralscape/types";

// ── Mock external deps ───────────────────────────────────────────────

vi.mock("@pluralscape/crypto", async () => {
  const { createCryptoMock } = await import("../../helpers/mock-crypto.js");
  return createCryptoMock();
});

vi.mock("../../../lib/audit-log.js", () => ({
  writeAuditLog: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../../../lib/system-ownership.js", () => ({
  assertSystemOwnership: vi.fn(),
}));

vi.mock("../../../lib/validate-subject-ids.js", () => ({
  validateSubjectIds: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../../../services/webhook-dispatcher.js", () => ({
  dispatchWebhookEvent: vi.fn().mockResolvedValue([]),
}));

// ── Import under test ────────────────────────────────────────────────

const { getActiveFronting, parseFrontingSessionQuery } =
  await import("../../../services/fronting-session/queries.js");

// ── Tests ────────────────────────────────────────────────────────────

describe("getActiveFronting", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns empty sessions and isCofronting false when no active sessions", async () => {
    const { db } = mockDb();

    const result = await getActiveFronting(db, SYSTEM_ID, AUTH);

    expect(result.sessions).toEqual([]);
    expect(result.isCofronting).toBe(false);
    expect(result.entityMemberMap).toEqual({});
  });

  it("returns isCofronting false for single member session", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([makeFSRow()]);

    const result = await getActiveFronting(db, SYSTEM_ID, AUTH);

    expect(result.sessions).toHaveLength(1);
    expect(result.isCofronting).toBe(false);
  });

  it("returns isCofronting true for multiple member sessions", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([
      makeFSRow({ id: "fs_00000000-0000-0000-0000-000000000001" }),
      makeFSRow({
        id: "fs_00000000-0000-0000-0000-000000000002",
        memberId: "mem_00000000-0000-0000-0000-000000000099",
      }),
    ]);

    const result = await getActiveFronting(db, SYSTEM_ID, AUTH);

    expect(result.sessions).toHaveLength(2);
    expect(result.isCofronting).toBe(true);
  });

  it("does not count custom-front-only sessions for cofronting", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([
      makeFSRow({ id: "fs_00000000-0000-0000-0000-000000000001" }),
      makeFSRow({
        id: "fs_00000000-0000-0000-0000-000000000002",
        memberId: null,
        customFrontId: CF_ID,
        structureEntityId: null,
      }),
    ]);

    const result = await getActiveFronting(db, SYSTEM_ID, AUTH);

    expect(result.sessions).toHaveLength(2);
    // Only one member session, so not cofronting
    expect(result.isCofronting).toBe(false);
  });

  it("counts structureEntityId sessions for cofronting", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([
      makeFSRow({ id: "fs_00000000-0000-0000-0000-000000000001" }),
      makeFSRow({
        id: "fs_00000000-0000-0000-0000-000000000002",
        memberId: null,
        structureEntityId: SE_ID,
      }),
    ]);
    // First where call (main query) returns chain; second where call (links query) resolves directly
    chain.where
      .mockReturnValueOnce(chain) // main session query → .orderBy()
      .mockResolvedValueOnce([]); // links query resolves to empty array

    const result = await getActiveFronting(db, SYSTEM_ID, AUTH);

    expect(result.isCofronting).toBe(true);
  });

  it("builds entityMemberMap from link query", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([
      makeFSRow({ id: "fs_00000000-0000-0000-0000-000000000001", structureEntityId: SE_ID }),
    ]);
    // First where (main query) returns chain; second where (links) resolves to links array
    chain.where
      .mockReturnValueOnce(chain) // main session query → .orderBy()
      .mockResolvedValueOnce([
        { parentEntityId: SE_ID, memberId: "mem_00000000-0000-0000-0000-000000000011" },
        { parentEntityId: SE_ID, memberId: "mem_00000000-0000-0000-0000-000000000012" },
      ]);

    const result = await getActiveFronting(db, SYSTEM_ID, AUTH);

    expect(result.entityMemberMap[SE_ID]).toEqual([
      "mem_00000000-0000-0000-0000-000000000011",
      "mem_00000000-0000-0000-0000-000000000012",
    ]);
  });

  it("skips link query when no structureEntityIds in sessions", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([makeFSRow({ structureEntityId: null })]);

    const result = await getActiveFronting(db, SYSTEM_ID, AUTH);

    expect(result.entityMemberMap).toEqual({});
  });

  it("handles multiple entities in entityMemberMap", async () => {
    const seId2 = brandId<SystemStructureEntityId>("ste_00000000-0000-0000-0000-000000000002");
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([
      makeFSRow({ id: "fs_00000000-0000-0000-0000-000000000001", structureEntityId: SE_ID }),
      makeFSRow({
        id: "fs_00000000-0000-0000-0000-000000000002",
        memberId: null,
        structureEntityId: seId2,
      }),
    ]);
    // First where (main query) returns chain; second where (links) resolves to array
    chain.where
      .mockReturnValueOnce(chain) // main session query → .orderBy()
      .mockResolvedValueOnce([
        { parentEntityId: SE_ID, memberId: "mem_00000000-0000-0000-0000-00000000000a" },
        { parentEntityId: seId2, memberId: "mem_00000000-0000-0000-0000-00000000000b" },
        { parentEntityId: seId2, memberId: "mem_00000000-0000-0000-0000-00000000000c" },
      ]);

    const result = await getActiveFronting(db, SYSTEM_ID, AUTH);

    expect(result.entityMemberMap[SE_ID]).toEqual(["mem_00000000-0000-0000-0000-00000000000a"]);
    expect(result.entityMemberMap[seId2]).toEqual([
      "mem_00000000-0000-0000-0000-00000000000b",
      "mem_00000000-0000-0000-0000-00000000000c",
    ]);
  });
});

describe("parseFrontingSessionQuery", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns parsed query for valid input", () => {
    const result = parseFrontingSessionQuery({});

    expect(typeof result).toBe("object");
  });

  it("parses valid activeOnly filter", () => {
    const result = parseFrontingSessionQuery({ activeOnly: "true" });

    expect(result.activeOnly).toBe(true);
  });

  it("parses endFrom filter", () => {
    const result = parseFrontingSessionQuery({ endFrom: "1000" });

    expect(result.endFrom).toBe(1000);
  });

  it("parses endUntil filter", () => {
    const result = parseFrontingSessionQuery({ endUntil: "2000" });

    expect(result.endUntil).toBe(2000);
  });

  it("parses both endFrom and endUntil filters", () => {
    const result = parseFrontingSessionQuery({ endFrom: "1000", endUntil: "2000" });

    expect(result.endFrom).toBe(1000);
    expect(result.endUntil).toBe(2000);
  });

  it("throws 400 VALIDATION_ERROR for invalid memberId prefix", () => {
    expect(() => parseFrontingSessionQuery({ memberId: "invalid_no_prefix" })).toThrow(
      expect.objectContaining({ status: 400, code: "VALIDATION_ERROR" }),
    );
  });
});
