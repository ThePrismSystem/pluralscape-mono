import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  mockAuditWriterFactory,
  mockAuthFactory,
  mockDbFactory,
  mockRateLimitFactory,
  mockSystemOwnershipFactory,
} from "../../../helpers/common-route-mocks.js";
import { MOCK_AUTH, createRouteApp, putJSON } from "../../../helpers/route-test-setup.js";

import type { ApiErrorResponse } from "@pluralscape/types";

// ── Mocks ────────────────────────────────────────────────────────

vi.mock("../../../../services/member-photo.service.js", () => ({
  reorderMemberPhotos: vi.fn(),
}));

vi.mock("../../../../lib/audit-writer.js", () => mockAuditWriterFactory());

vi.mock("../../../../lib/db.js", () => mockDbFactory());

vi.mock("../../../../middleware/rate-limit.js", () => mockRateLimitFactory());

vi.mock("../../../../lib/system-ownership.js", () => mockSystemOwnershipFactory());

vi.mock("../../../../middleware/auth.js", () => mockAuthFactory());

// ── Imports after mocks ──────────────────────────────────────────

const { reorderMemberPhotos } = await import("../../../../services/member-photo.service.js");
const { systemRoutes } = await import("../../../../routes/systems/index.js");

// ── Helpers ──────────────────────────────────────────────────────

const SYS_ID = "sys_550e8400-e29b-41d4-a716-446655440000";
const MEM_ID = "mem_550e8400-e29b-41d4-a716-446655440000";
const PHOTO_ID = "mp_550e8400-e29b-41d4-a716-446655440000";

const createApp = () => createRouteApp("/systems", systemRoutes);

const PHOTO_RESULT = {
  id: PHOTO_ID as never,
  memberId: MEM_ID as never,
  systemId: SYS_ID as never,
  sortOrder: 0,
  encryptedData: "dGVzdA==",
  version: 1,
  createdAt: 1000 as never,
  updatedAt: 1000 as never,
  archived: false,
  archivedAt: null,
};

const VALID_BODY = { order: [PHOTO_ID] };
const REORDER_PATH = `/systems/${SYS_ID}/members/${MEM_ID}/photos/reorder`;

// ── Tests ────────────────────────────────────────────────────────

describe("PUT /systems/:systemId/members/:memberId/photos/reorder", () => {
  beforeEach(() => {
    vi.mocked(reorderMemberPhotos).mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 200 with items array in data envelope on success", async () => {
    vi.mocked(reorderMemberPhotos).mockResolvedValueOnce([PHOTO_RESULT]);

    const app = createApp();
    const res = await putJSON(app, REORDER_PATH, VALID_BODY);

    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { data: (typeof PHOTO_RESULT)[] } };
    expect(body.data.data).toHaveLength(1);
    expect(body.data.data[0]?.id).toBe(PHOTO_ID);
  });

  it("forwards systemId, memberId, body, and auth to service", async () => {
    vi.mocked(reorderMemberPhotos).mockResolvedValueOnce([PHOTO_RESULT]);

    const app = createApp();
    await putJSON(app, REORDER_PATH, VALID_BODY);

    expect(vi.mocked(reorderMemberPhotos)).toHaveBeenCalledWith(
      expect.anything(),
      SYS_ID,
      MEM_ID,
      VALID_BODY,
      MOCK_AUTH,
      expect.any(Function),
    );
  });

  it("returns 400 for malformed JSON body", async () => {
    const app = createApp();
    const res = await app.request(REORDER_PATH, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: "not valid json{{{",
    });

    expect(res.status).toBe(400);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("re-throws unexpected errors as 500", async () => {
    vi.mocked(reorderMemberPhotos).mockRejectedValueOnce(new Error("DB timeout"));
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    const app = createApp();
    const res = await putJSON(app, REORDER_PATH, VALID_BODY);

    expect(res.status).toBe(500);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("INTERNAL_ERROR");
  });
});
