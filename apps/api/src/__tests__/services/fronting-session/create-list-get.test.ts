import { brandId } from "@pluralscape/types";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { captureWhereArg, mockDb } from "../../helpers/mock-db.js";
import { mockOwnershipFailure } from "../../helpers/mock-ownership.js";

import {
  AUTH,
  CF_ID,
  FS_ID,
  MEMBER_ID,
  SE_ID,
  SYSTEM_ID,
  VALID_BLOB_BASE64,
  makeFSRow,
} from "./internal.js";

import type { MockChain } from "../../helpers/mock-db.js";
import type { FrontingSessionId } from "@pluralscape/types";

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

const { assertSystemOwnership } = await import("../../../lib/system-ownership.js");
const { createFrontingSession } = await import("../../../services/fronting-session/create.js");
const { listFrontingSessions, getFrontingSession } =
  await import("../../../services/fronting-session/queries.js");

// ── Fixtures ─────────────────────────────────────────────────────────

const mockAudit = vi.fn().mockResolvedValue(undefined);

/** Valid create params that pass CreateFrontingSessionBodySchema (requires at least one subject). */
const VALID_CREATE_PARAMS = {
  encryptedData: VALID_BLOB_BASE64,
  startTime: 1000,
  memberId: MEMBER_ID,
  customFrontId: undefined,
  structureEntityId: undefined,
  endTime: undefined,
};

// ── Tests ────────────────────────────────────────────────────────────

describe("createFrontingSession", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    mockAudit.mockClear();
  });

  it("creates a fronting session successfully", async () => {
    const { db, chain } = mockDb();
    chain.returning.mockResolvedValueOnce([makeFSRow()]);

    const result = await createFrontingSession(db, SYSTEM_ID, VALID_CREATE_PARAMS, AUTH, mockAudit);

    expect(result.id).toBe(FS_ID);
    expect(chain.transaction).toHaveBeenCalled();
    expect(mockAudit).toHaveBeenCalledWith(
      chain,
      expect.objectContaining({ eventType: "fronting-session.created" }),
    );
  });

  it("throws 404 for system ownership failure", async () => {
    mockOwnershipFailure(vi.mocked(assertSystemOwnership));
    const { db } = mockDb();

    await expect(
      createFrontingSession(db, SYSTEM_ID, VALID_CREATE_PARAMS, AUTH, mockAudit),
    ).rejects.toThrow(expect.objectContaining({ status: 404, code: "NOT_FOUND" }));
  });

  it("throws when INSERT returns no rows", async () => {
    const { db, chain } = mockDb();
    chain.returning.mockResolvedValueOnce([]);

    await expect(
      createFrontingSession(db, SYSTEM_ID, VALID_CREATE_PARAMS, AUTH, mockAudit),
    ).rejects.toThrow("Failed to create fronting session");
  });

  it("calls audit writer with correct params after successful insert", async () => {
    const { db, chain } = mockDb();
    chain.returning.mockResolvedValueOnce([makeFSRow()]);

    await createFrontingSession(db, SYSTEM_ID, VALID_CREATE_PARAMS, AUTH, mockAudit);

    expect(mockAudit).toHaveBeenCalledWith(chain, {
      eventType: "fronting-session.created",
      actor: { kind: "account", id: AUTH.accountId },
      detail: "Fronting session created",
      systemId: SYSTEM_ID,
    });
  });

  it("creates a fronting session with endTime", async () => {
    const { db, chain } = mockDb();
    chain.returning.mockResolvedValueOnce([makeFSRow({ endTime: 2000 })]);
    const { dispatchWebhookEvent } = await import("../../../services/webhook-dispatcher.js");

    const result = await createFrontingSession(
      db,
      SYSTEM_ID,
      { ...VALID_CREATE_PARAMS, endTime: 2000 },
      AUTH,
      mockAudit,
    );

    expect(result.endTime).toBe(2000);
    expect(vi.mocked(dispatchWebhookEvent)).toHaveBeenCalledWith(
      chain,
      SYSTEM_ID,
      "fronting.ended",
      expect.objectContaining({ sessionId: expect.any(String) }),
    );
    expect(mockAudit).toHaveBeenCalledWith(
      chain,
      expect.objectContaining({ eventType: "fronting-session.ended" }),
    );
  });

  it("throws 400 when endTime < startTime", async () => {
    const { db } = mockDb();

    await expect(
      createFrontingSession(
        db,
        SYSTEM_ID,
        { ...VALID_CREATE_PARAMS, endTime: 500 },
        AUTH,
        mockAudit,
      ),
    ).rejects.toThrow(expect.objectContaining({ status: 400, code: "VALIDATION_ERROR" }));
  });

  it("throws 400 when endTime equals startTime", async () => {
    const { db } = mockDb();

    await expect(
      createFrontingSession(
        db,
        SYSTEM_ID,
        { ...VALID_CREATE_PARAMS, endTime: 1000 },
        AUTH,
        mockAudit,
      ),
    ).rejects.toThrow(expect.objectContaining({ status: 400, code: "VALIDATION_ERROR" }));
  });

  it("creates a fronting session without endTime (stays null)", async () => {
    const { db, chain } = mockDb();
    chain.returning.mockResolvedValueOnce([makeFSRow()]);

    const result = await createFrontingSession(db, SYSTEM_ID, VALID_CREATE_PARAMS, AUTH, mockAudit);

    expect(result.endTime).toBeNull();
  });
});

describe("listFrontingSessions", () => {
  async function callListWithFilter(opts = {}): Promise<MockChain> {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([]);
    await listFrontingSessions(db, SYSTEM_ID, AUTH, opts);
    return chain;
  }

  let baseWhereArg: unknown;
  beforeAll(async () => {
    const chain = await callListWithFilter();
    baseWhereArg = captureWhereArg(chain);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns empty page when no sessions exist", async () => {
    const { db } = mockDb();

    const result = await listFrontingSessions(db, SYSTEM_ID, AUTH);

    expect(result.data).toEqual([]);
    expect(result.hasMore).toBe(false);
  });

  it("returns sessions for system", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([makeFSRow()]);

    const result = await listFrontingSessions(db, SYSTEM_ID, AUTH);

    expect(result.data).toHaveLength(1);
    expect(result.data[0]?.id).toBe(FS_ID);
  });

  it("applies cursor when provided", async () => {
    const chain = await callListWithFilter({ cursor: "fs_cursor-id" });

    expect(chain.where).toHaveBeenCalledTimes(1);
    expect(captureWhereArg(chain)).not.toEqual(baseWhereArg);
  });

  it("applies memberId filter", async () => {
    const chain = await callListWithFilter({ memberId: MEMBER_ID });

    expect(chain.where).toHaveBeenCalledTimes(1);
    expect(captureWhereArg(chain)).not.toEqual(baseWhereArg);
  });

  it("applies customFrontId filter", async () => {
    const chain = await callListWithFilter({ customFrontId: CF_ID });

    expect(chain.where).toHaveBeenCalledTimes(1);
    expect(captureWhereArg(chain)).not.toEqual(baseWhereArg);
  });

  it("applies structureEntityId filter", async () => {
    const chain = await callListWithFilter({ structureEntityId: SE_ID });

    expect(chain.where).toHaveBeenCalledTimes(1);
    expect(captureWhereArg(chain)).not.toEqual(baseWhereArg);
  });

  it("applies startFrom filter", async () => {
    const chain = await callListWithFilter({ startFrom: 500 });

    expect(chain.where).toHaveBeenCalledTimes(1);
    expect(captureWhereArg(chain)).not.toEqual(baseWhereArg);
  });

  it("applies startUntil filter", async () => {
    const chain = await callListWithFilter({ startUntil: 2000 });

    expect(chain.where).toHaveBeenCalledTimes(1);
    expect(captureWhereArg(chain)).not.toEqual(baseWhereArg);
  });

  it("applies endFrom filter", async () => {
    const chain = await callListWithFilter({ endFrom: 500 });

    expect(chain.where).toHaveBeenCalledTimes(1);
    expect(captureWhereArg(chain)).not.toEqual(baseWhereArg);
  });

  it("applies endUntil filter", async () => {
    const chain = await callListWithFilter({ endUntil: 2000 });

    expect(chain.where).toHaveBeenCalledTimes(1);
    expect(captureWhereArg(chain)).not.toEqual(baseWhereArg);
  });

  it("applies both endFrom and endUntil filters", async () => {
    const chain = await callListWithFilter({ endFrom: 500, endUntil: 2000 });

    expect(chain.where).toHaveBeenCalledTimes(1);
    expect(captureWhereArg(chain)).not.toEqual(baseWhereArg);
  });

  it("applies activeOnly filter", async () => {
    const chain = await callListWithFilter({ activeOnly: true });

    expect(chain.where).toHaveBeenCalledTimes(1);
    expect(captureWhereArg(chain)).not.toEqual(baseWhereArg);
  });

  it("includes archived sessions when includeArchived is true", async () => {
    const chain = await callListWithFilter({ includeArchived: true });

    expect(chain.where).toHaveBeenCalledTimes(1);
    expect(captureWhereArg(chain)).not.toEqual(baseWhereArg);
  });

  it("excludes archived sessions by default", async () => {
    const chain = await callListWithFilter();

    expect(chain.where).toHaveBeenCalledTimes(1);
  });

  it("caps limit to MAX_PAGE_LIMIT", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([]);

    await listFrontingSessions(db, SYSTEM_ID, AUTH, { limit: 999 });

    // MAX_PAGE_LIMIT is 100, so limit should be called with 101 (effectiveLimit + 1)
    expect(chain.limit).toHaveBeenCalledWith(101);
  });

  it("uses DEFAULT_PAGE_LIMIT when no limit provided", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([]);

    await listFrontingSessions(db, SYSTEM_ID, AUTH);

    // DEFAULT_PAGE_LIMIT is 25, so limit should be called with 26
    expect(chain.limit).toHaveBeenCalledWith(26);
  });
});

describe("getFrontingSession", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns session for valid ID", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([makeFSRow()]);

    const result = await getFrontingSession(db, SYSTEM_ID, FS_ID, AUTH);

    expect(result.id).toBe(FS_ID);
  });

  it("throws 404 when not found", async () => {
    const { db } = mockDb();

    await expect(
      getFrontingSession(
        db,
        SYSTEM_ID,
        brandId<FrontingSessionId>("fs_00000000-0000-0000-0000-000000000000"),
        AUTH,
      ),
    ).rejects.toThrow(expect.objectContaining({ status: 404, code: "NOT_FOUND" }));
  });
});
