import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  mockAuditWriterFactory,
  mockAuthFactory,
  mockDbFactory,
  mockRateLimitFactory,
} from "../../../helpers/common-route-mocks.js";
import { createRouteApp, postJSON } from "../../../helpers/route-test-setup.js";

import type { ApiErrorResponse } from "@pluralscape/types";

// ── Mocks ────────────────────────────────────────────────────────

vi.mock("../../../../services/snapshot.service.js", () => ({
  createSnapshot: vi.fn(),
}));
vi.mock("../../../../lib/audit-writer.js", () => mockAuditWriterFactory());
vi.mock("../../../../lib/db.js", () => mockDbFactory());
vi.mock("../../../../middleware/rate-limit.js", () => mockRateLimitFactory());
vi.mock("../../../../middleware/auth.js", () => mockAuthFactory());

// ── Imports after mocks ──────────────────────────────────────────

const { createSnapshot } = await import("../../../../services/snapshot.service.js");
const { systemRoutes } = await import("../../../../routes/systems/index.js");

// ── Helpers ──────────────────────────────────────────────────────

const createApp = () => createRouteApp("/systems", systemRoutes);

const SYS_ID = "sys_550e8400-e29b-41d4-a716-446655440000";
const SNAPSHOT_ID = "snap_660e8400-e29b-41d4-a716-446655440000";
const CREATE_URL = `/systems/${SYS_ID}/snapshots`;

const VALID_BODY = {
  encryptedData: "dGVzdA==",
  snapshotTrigger: "manual" as const,
};

const MOCK_RESULT = {
  id: SNAPSHOT_ID as never,
  systemId: SYS_ID as never,
  snapshotTrigger: "manual" as const,
  encryptedData: "dGVzdA==",
  createdAt: 1000 as never,
};

// ── Tests ────────────────────────────────────────────────────────

// No error-mapping cases — createSnapshot does not throw ApiHttpError.
describe("POST /systems/:systemId/snapshots", () => {
  beforeEach(() => {
    vi.mocked(createSnapshot).mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 201 with created snapshot", async () => {
    vi.mocked(createSnapshot).mockResolvedValueOnce(MOCK_RESULT);

    const res = await postJSON(createApp(), CREATE_URL, VALID_BODY);

    expect(res.status).toBe(201);
    const body = (await res.json()) as { data: { id: string } };
    expect(body.data.id).toBe(SNAPSHOT_ID);
  });

  it("passes body and systemId to service", async () => {
    vi.mocked(createSnapshot).mockResolvedValueOnce(MOCK_RESULT);

    await postJSON(createApp(), CREATE_URL, VALID_BODY);

    expect(vi.mocked(createSnapshot)).toHaveBeenCalledWith(
      {},
      SYS_ID,
      VALID_BODY,
      expect.any(Object),
      expect.any(Function),
    );
  });

  it("returns 400 for invalid systemId format", async () => {
    const res = await postJSON(createApp(), `/systems/not-valid/snapshots`, VALID_BODY);

    expect(res.status).toBe(400);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 400 when body is not valid JSON", async () => {
    const res = await createApp().request(CREATE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not json",
    });

    expect(res.status).toBe(400);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });
});
