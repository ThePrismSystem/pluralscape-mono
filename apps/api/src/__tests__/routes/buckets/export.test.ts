import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  mockAuthFactory,
  mockDbFactory,
  mockRateLimitFactory,
} from "../../helpers/common-route-mocks.js";
import { createRouteApp } from "../../helpers/route-test-setup.js";

import type {
  BucketExportManifestResponse,
  BucketExportPageResponse,
  BucketId,
  SystemId,
  UnixMillis,
} from "@pluralscape/types";

// ── Mocks ────────────────────────────────────────────────────────

vi.mock("../../../services/bucket-export.service.js", () => ({
  getBucketExportManifest: vi.fn(),
  getBucketExportPage: vi.fn(),
}));

vi.mock("../../../lib/db.js", () => mockDbFactory());

vi.mock("../../../middleware/rate-limit.js", () => mockRateLimitFactory());

vi.mock("../../../middleware/auth.js", () => mockAuthFactory());

// ── Imports after mocks ──────────────────────────────────────────

const { getBucketExportManifest, getBucketExportPage } =
  await import("../../../services/bucket-export.service.js");
const { systemRoutes } = await import("../../../routes/systems/index.js");

// ── Helpers ──────────────────────────────────────────────────────

const createApp = () => createRouteApp("/systems", systemRoutes);

const SYS_ID = "sys_550e8400-e29b-41d4-a716-446655440000";
const BUCKET_ID = "bkt_660e8400-e29b-41d4-a716-446655440000";
const MANIFEST_URL = `/systems/${SYS_ID}/buckets/${BUCKET_ID}/export/manifest`;
const EXPORT_URL = `/systems/${SYS_ID}/buckets/${BUCKET_ID}/export`;

const MOCK_MANIFEST: BucketExportManifestResponse = {
  systemId: SYS_ID as SystemId,
  bucketId: BUCKET_ID as BucketId,
  entries: [
    { entityType: "member", count: 3, lastUpdatedAt: 1000 as UnixMillis },
    { entityType: "group", count: 0, lastUpdatedAt: null },
  ],
  etag: 'W/"abc123"',
};

const MOCK_PAGE: BucketExportPageResponse = {
  items: [
    {
      id: "mem_550e8400-e29b-41d4-a716-446655440000",
      entityType: "member",
      encryptedData: "dGVzdA==",
      updatedAt: 1000 as UnixMillis,
    },
  ],
  nextCursor: null,
  hasMore: false,
  totalCount: null,
  etag: 'W/"def456"',
};

// ── Manifest tests ──────────────────────────────────────────────

describe("GET /systems/:systemId/buckets/:bucketId/export/manifest", () => {
  beforeEach(() => {
    vi.mocked(getBucketExportManifest).mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 200 with manifest data", async () => {
    vi.mocked(getBucketExportManifest).mockResolvedValueOnce(MOCK_MANIFEST);

    const res = await createApp().request(MANIFEST_URL);

    expect(res.status).toBe(200);
    const body = (await res.json()) as BucketExportManifestResponse;
    expect(body.systemId).toBe(SYS_ID);
    expect(body.entries).toHaveLength(2);
  });

  it("sets ETag header from manifest response", async () => {
    vi.mocked(getBucketExportManifest).mockResolvedValueOnce(MOCK_MANIFEST);

    const res = await createApp().request(MANIFEST_URL);

    expect(res.headers.get("ETag")).toBe('W/"abc123"');
  });

  it("returns 304 when If-None-Match matches ETag", async () => {
    vi.mocked(getBucketExportManifest).mockResolvedValueOnce(MOCK_MANIFEST);

    const res = await createApp().request(MANIFEST_URL, {
      headers: { "If-None-Match": 'W/"abc123"' },
    });

    expect(res.status).toBe(304);
  });

  it("returns 400 for invalid bucket ID prefix", async () => {
    const badUrl = `/systems/${SYS_ID}/buckets/bad_id/export/manifest`;
    const res = await createApp().request(badUrl);

    expect(res.status).toBe(400);
  });
});

// ── Page tests ──────────────────────────────────────────────────

describe("GET /systems/:systemId/buckets/:bucketId/export", () => {
  beforeEach(() => {
    vi.mocked(getBucketExportPage).mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 200 with page data", async () => {
    vi.mocked(getBucketExportPage).mockResolvedValueOnce(MOCK_PAGE);

    const res = await createApp().request(`${EXPORT_URL}?entityType=member`);

    expect(res.status).toBe(200);
    const body = (await res.json()) as BucketExportPageResponse;
    expect(body.items).toHaveLength(1);
    expect(body.items[0]?.entityType).toBe("member");
  });

  it("returns 400 for missing entityType", async () => {
    const res = await createApp().request(EXPORT_URL);

    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid entityType", async () => {
    const res = await createApp().request(`${EXPORT_URL}?entityType=invalid`);

    expect(res.status).toBe(400);
  });

  it("sets ETag header from page response", async () => {
    vi.mocked(getBucketExportPage).mockResolvedValueOnce(MOCK_PAGE);

    const res = await createApp().request(`${EXPORT_URL}?entityType=member`);

    expect(res.headers.get("ETag")).toBe('W/"def456"');
  });

  it("returns 304 when If-None-Match matches ETag", async () => {
    vi.mocked(getBucketExportPage).mockResolvedValueOnce(MOCK_PAGE);

    const res = await createApp().request(`${EXPORT_URL}?entityType=member`, {
      headers: { "If-None-Match": 'W/"def456"' },
    });

    expect(res.status).toBe(304);
  });

  it("passes limit and cursor to service", async () => {
    vi.mocked(getBucketExportPage).mockResolvedValueOnce(MOCK_PAGE);

    await createApp().request(`${EXPORT_URL}?entityType=member&limit=25&cursor=abc`);

    expect(getBucketExportPage).toHaveBeenCalledWith(
      expect.anything(),
      expect.any(String),
      expect.any(String),
      expect.anything(),
      "member",
      25,
      "abc",
    );
  });
});
