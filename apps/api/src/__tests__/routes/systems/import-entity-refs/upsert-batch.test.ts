import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  mockAuditWriterFactory,
  mockAuthFactory,
  mockDbFactory,
  mockRateLimitFactory,
} from "../../../helpers/common-route-mocks.js";
import { MOCK_SYSTEM_ID, createRouteApp, postJSON } from "../../../helpers/route-test-setup.js";

// ── Mocks ────────────────────────────────────────────────────────

vi.mock("../../../../services/system/import-entity-refs/lookup.js", () => ({
  lookupImportEntityRef: vi.fn(),
  lookupImportEntityRefBatch: vi.fn(),
}));
vi.mock("../../../../services/system/import-entity-refs/upsert-batch.js", () => ({
  upsertImportEntityRefBatch: vi.fn(),
}));
vi.mock("../../../../services/system/import-entity-refs/record.js", () => ({
  recordImportEntityRef: vi.fn(),
}));
vi.mock("../../../../services/system/import-entity-refs/list.js", () => ({
  listImportEntityRefs: vi.fn(),
}));

vi.mock("../../../../lib/audit-writer.js", () => mockAuditWriterFactory());
vi.mock("../../../../lib/db.js", () => mockDbFactory());
vi.mock("../../../../middleware/rate-limit.js", () => mockRateLimitFactory());
vi.mock("../../../../middleware/auth.js", () => mockAuthFactory());

// ── Imports after mocks ──────────────────────────────────────────

const { upsertImportEntityRefBatch } =
  await import("../../../../services/system/import-entity-refs/upsert-batch.js");
const { systemRoutes } = await import("../../../../routes/systems/index.js");

const createApp = () => createRouteApp("/systems", systemRoutes);

const BASE_URL = `/systems/${MOCK_SYSTEM_ID}/import-entity-refs/upsert-batch`;

describe("POST /systems/:systemId/import-entity-refs/upsert-batch", () => {
  beforeEach(() => {
    vi.mocked(upsertImportEntityRefBatch).mockReset();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 200 with the upserted/unchanged counts", async () => {
    vi.mocked(upsertImportEntityRefBatch).mockResolvedValueOnce({
      upserted: 2,
      unchanged: 1,
    });

    const app = createApp();
    const res = await postJSON(app, BASE_URL, {
      source: "simply-plural",
      entries: [
        {
          sourceEntityType: "member",
          sourceEntityId: "src-a",
          pluralscapeEntityId: "mem_a",
        },
        {
          sourceEntityType: "member",
          sourceEntityId: "src-b",
          pluralscapeEntityId: "mem_b",
        },
        {
          sourceEntityType: "member",
          sourceEntityId: "src-c",
          pluralscapeEntityId: "mem_c",
        },
      ],
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { upserted: number; unchanged: number } };
    expect(body.data).toEqual({ upserted: 2, unchanged: 1 });
    expect(vi.mocked(upsertImportEntityRefBatch)).toHaveBeenCalledOnce();
  });

  it("returns 400 when entries is empty", async () => {
    const app = createApp();
    const res = await postJSON(app, BASE_URL, {
      source: "simply-plural",
      entries: [],
    });

    expect(res.status).toBe(400);
    expect(vi.mocked(upsertImportEntityRefBatch)).not.toHaveBeenCalled();
  });

  it("returns 400 when entries exceeds the cap", async () => {
    const app = createApp();
    const res = await postJSON(app, BASE_URL, {
      source: "simply-plural",
      entries: Array.from({ length: 201 }, (_, i) => ({
        sourceEntityType: "member" as const,
        sourceEntityId: `id-${String(i)}`,
        pluralscapeEntityId: `mem_${String(i)}`,
      })),
    });

    expect(res.status).toBe(400);
  });

  it("returns 400 when an entry has an invalid sourceEntityType", async () => {
    const app = createApp();
    const res = await postJSON(app, BASE_URL, {
      source: "simply-plural",
      entries: [{ sourceEntityType: "banana", sourceEntityId: "x", pluralscapeEntityId: "y" }],
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
