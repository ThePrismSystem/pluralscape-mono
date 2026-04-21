import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  mockAuditWriterFactory,
  mockAuthFactory,
  mockDbFactory,
  mockRateLimitFactory,
} from "../../helpers/common-route-mocks.js";
import { MOCK_AUTH, createRouteApp } from "../../helpers/route-test-setup.js";

// ── Mocks ────────────────────────────────────────────────────────

vi.mock("../../../services/fronting-session/create.js", () => ({
  createFrontingSession: vi.fn(),
}));

vi.mock("../../../services/fronting-session/queries.js", () => ({
  listFrontingSessions: vi.fn(),
  getFrontingSession: vi.fn(),
  getActiveFronting: vi.fn(),
  parseFrontingSessionQuery: vi.fn().mockReturnValue({}),
}));

vi.mock("../../../services/fronting-session/update.js", () => ({
  updateFrontingSession: vi.fn(),
  endFrontingSession: vi.fn(),
}));

vi.mock("../../../services/fronting-session/lifecycle.js", () => ({
  deleteFrontingSession: vi.fn(),
  archiveFrontingSession: vi.fn(),
  restoreFrontingSession: vi.fn(),
}));

vi.mock("../../../services/fronting-comment.service.js", () => ({
  createFrontingComment: vi.fn(),
  listFrontingComments: vi.fn(),
  getFrontingComment: vi.fn(),
  updateFrontingComment: vi.fn(),
  deleteFrontingComment: vi.fn(),
  archiveFrontingComment: vi.fn(),
  restoreFrontingComment: vi.fn(),
}));

vi.mock("../../../lib/audit-writer.js", () => mockAuditWriterFactory());

vi.mock("../../../lib/db.js", () => mockDbFactory());

vi.mock("../../../middleware/rate-limit.js", () => mockRateLimitFactory());

vi.mock("../../../middleware/auth.js", () => mockAuthFactory());
// ── Imports after mocks ──────────────────────────────────────────

const { getActiveFronting } = await import("../../../services/fronting-session/queries.js");
const { systemRoutes } = await import("../../../routes/systems/index.js");

// ── Helpers ──────────────────────────────────────────────────────

const createApp = () => createRouteApp("/systems", systemRoutes);

const ACTIVE_URL = "/systems/sys_550e8400-e29b-41d4-a716-446655440000/fronting/active";

const MOCK_SESSION = {
  id: "fs_660e8400-e29b-41d4-a716-446655440000" as never,
  systemId: MOCK_AUTH.systemId as never,
  memberId: "mem_770e8400-e29b-41d4-a716-446655440000" as never,
  customFrontId: null,
  structureEntityId: null,
  startTime: 1000 as never,
  endTime: null,
  encryptedData: "dGVzdA==",
  version: 1,
  archived: false,
  archivedAt: null,
  createdAt: 1000 as never,
  updatedAt: 1000 as never,
};

// ── Tests ────────────────────────────────────────────────────────

describe("GET /systems/:id/fronting/active", () => {
  beforeEach(() => {
    vi.mocked(getActiveFronting).mockReset();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 200 with empty sessions when nobody is fronting", async () => {
    vi.mocked(getActiveFronting).mockResolvedValueOnce({
      sessions: [],
      isCofronting: false,
      entityMemberMap: {},
    });

    const app = createApp();
    const res = await app.request(ACTIVE_URL);

    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { sessions: unknown[]; isCofronting: boolean } };
    expect(body.data.sessions).toEqual([]);
    expect(body.data.isCofronting).toBe(false);
  });

  it("returns single active session", async () => {
    vi.mocked(getActiveFronting).mockResolvedValueOnce({
      sessions: [MOCK_SESSION],
      isCofronting: false,
      entityMemberMap: {},
    });

    const app = createApp();
    const res = await app.request(ACTIVE_URL);

    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { sessions: unknown[]; isCofronting: boolean } };
    expect(body.data.sessions).toHaveLength(1);
    expect(body.data.isCofronting).toBe(false);
  });

  it("returns isCofronting true when multiple sessions active", async () => {
    const session2 = {
      ...MOCK_SESSION,
      id: "fs_880e8400-e29b-41d4-a716-446655440000" as never,
      memberId: "mem_990e8400-e29b-41d4-a716-446655440000" as never,
    };

    vi.mocked(getActiveFronting).mockResolvedValueOnce({
      sessions: [MOCK_SESSION, session2],
      isCofronting: true,
      entityMemberMap: {},
    });

    const app = createApp();
    const res = await app.request(ACTIVE_URL);

    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { sessions: unknown[]; isCofronting: boolean } };
    expect(body.data.sessions).toHaveLength(2);
    expect(body.data.isCofronting).toBe(true);
  });

  it("reports isCofronting false when only one member plus custom front", async () => {
    const customFrontSession = {
      ...MOCK_SESSION,
      id: "fs_880e8400-e29b-41d4-a716-446655440000" as never,
      memberId: null,
      customFrontId: "cf_990e8400-e29b-41d4-a716-446655440000" as never,
    };

    vi.mocked(getActiveFronting).mockResolvedValueOnce({
      sessions: [MOCK_SESSION, customFrontSession],
      isCofronting: false,
      entityMemberMap: {},
    });

    const app = createApp();
    const res = await app.request(ACTIVE_URL);

    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { sessions: unknown[]; isCofronting: boolean } };
    expect(body.data.sessions).toHaveLength(2);
    expect(body.data.isCofronting).toBe(false);
  });

  it("includes entity member map when structure entities are fronting", async () => {
    const entitySession = {
      ...MOCK_SESSION,
      memberId: null,
      structureEntityId: "ste_aa0e8400-e29b-41d4-a716-446655440000" as never,
    };

    vi.mocked(getActiveFronting).mockResolvedValueOnce({
      sessions: [entitySession],
      isCofronting: false,
      entityMemberMap: {
        "ste_aa0e8400-e29b-41d4-a716-446655440000": [
          "mem_770e8400-e29b-41d4-a716-446655440000",
          "mem_990e8400-e29b-41d4-a716-446655440000",
        ],
      },
    });

    const app = createApp();
    const res = await app.request(ACTIVE_URL);

    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      data: { entityMemberMap: Record<string, string[]> };
    };
    expect(body.data.entityMemberMap["ste_aa0e8400-e29b-41d4-a716-446655440000"]).toHaveLength(2);
  });
});
