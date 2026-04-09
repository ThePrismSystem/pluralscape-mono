import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  mockAuditWriterFactory,
  mockAuthFactory,
  mockDbFactory,
  mockRateLimitFactory,
} from "../../../helpers/common-route-mocks.js";
import { MOCK_SYSTEM_ID, createRouteApp, postJSON } from "../../../helpers/route-test-setup.js";

// ── Mocks ────────────────────────────────────────────────────────

vi.mock("../../../../services/import-entity-ref.service.js", () => ({
  lookupImportEntityRefBatch: vi.fn(),
  upsertImportEntityRefBatch: vi.fn(),
  recordImportEntityRef: vi.fn(),
  lookupImportEntityRef: vi.fn(),
  listImportEntityRefs: vi.fn(),
}));

vi.mock("../../../../lib/audit-writer.js", () => mockAuditWriterFactory());
vi.mock("../../../../lib/db.js", () => mockDbFactory());
vi.mock("../../../../middleware/rate-limit.js", () => mockRateLimitFactory());
vi.mock("../../../../middleware/auth.js", () => mockAuthFactory());

// ── Imports after mocks ──────────────────────────────────────────

const { lookupImportEntityRefBatch } =
  await import("../../../../services/import-entity-ref.service.js");
const { systemRoutes } = await import("../../../../routes/systems/index.js");

const createApp = () => createRouteApp("/systems", systemRoutes);

const BASE_URL = `/systems/${MOCK_SYSTEM_ID}/import-entity-refs/lookup-batch`;

describe("POST /systems/:systemId/import-entity-refs/lookup-batch", () => {
  beforeEach(() => {
    vi.mocked(lookupImportEntityRefBatch).mockReset();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 200 with a map of source ids to pluralscape ids", async () => {
    vi.mocked(lookupImportEntityRefBatch).mockResolvedValueOnce(
      new Map([
        ["src-a", "mem_a"],
        ["src-b", "mem_b"],
      ]),
    );

    const app = createApp();
    const res = await postJSON(app, BASE_URL, {
      source: "simply-plural",
      sourceEntityType: "member",
      sourceEntityIds: ["src-a", "src-b", "src-missing"],
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: Record<string, string> };
    expect(body.data).toEqual({ "src-a": "mem_a", "src-b": "mem_b" });
    expect(vi.mocked(lookupImportEntityRefBatch)).toHaveBeenCalledOnce();
  });

  it("returns 400 when sourceEntityIds is empty", async () => {
    const app = createApp();
    const res = await postJSON(app, BASE_URL, {
      source: "simply-plural",
      sourceEntityType: "member",
      sourceEntityIds: [],
    });

    expect(res.status).toBe(400);
    expect(vi.mocked(lookupImportEntityRefBatch)).not.toHaveBeenCalled();
  });

  it("returns 400 when source is invalid", async () => {
    const app = createApp();
    const res = await postJSON(app, BASE_URL, {
      source: "notion",
      sourceEntityType: "member",
      sourceEntityIds: ["x"],
    });

    expect(res.status).toBe(400);
  });

  it("returns 400 when sourceEntityIds exceeds the cap", async () => {
    const app = createApp();
    const res = await postJSON(app, BASE_URL, {
      source: "simply-plural",
      sourceEntityType: "member",
      sourceEntityIds: Array.from({ length: 201 }, (_, i) => `id-${String(i)}`),
    });

    expect(res.status).toBe(400);
  });

  it("returns 415 when Content-Type is not application/json", async () => {
    const app = createApp();
    const res = await app.request(BASE_URL, {
      method: "POST",
      body: "{}",
    });

    expect(res.status).toBe(415);
  });
});
