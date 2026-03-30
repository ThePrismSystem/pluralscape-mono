import { toUnixMillis } from "@pluralscape/types";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  mockApiKeyServiceFactory,
  mockAuditWriterFactory,
  mockAuthFactory,
  mockDbFactory,
  mockRateLimitFactory,
} from "../../helpers/common-route-mocks.js";
import { createRouteApp, postJSON } from "../../helpers/route-test-setup.js";

import type { ApiKeyCreateResult, ApiKeyResult } from "../../../services/api-key.service.js";
import type { PaginatedResult } from "@pluralscape/types";

// ── Mocks ────────────────────────────────────────────────────────

vi.mock("../../../services/api-key.service.js", () => mockApiKeyServiceFactory());

vi.mock("../../../lib/audit-writer.js", () => mockAuditWriterFactory());
vi.mock("../../../lib/db.js", () => mockDbFactory());
vi.mock("../../../middleware/rate-limit.js", () => mockRateLimitFactory());
vi.mock("../../../middleware/auth.js", () => mockAuthFactory());

// ── Imports after mocks ──────────────────────────────────────────

const { createApiKey, listApiKeys, getApiKey, revokeApiKey } =
  await import("../../../services/api-key.service.js");
const { systemRoutes } = await import("../../../routes/systems/index.js");

// ── Helpers ──────────────────────────────────────────────────────

const SYS_ID = "sys_550e8400-e29b-41d4-a716-446655440000";
const AK_ID = "ak_550e8400-e29b-41d4-a716-446655440001";

const createApp = () => createRouteApp("/systems", systemRoutes);

const MOCK_API_KEY_RESULT: ApiKeyResult = {
  id: AK_ID as ApiKeyResult["id"],
  systemId: SYS_ID as ApiKeyResult["systemId"],
  keyType: "metadata",
  scopes: ["read:members"],
  createdAt: toUnixMillis(1000),
  lastUsedAt: null,
  revokedAt: null,
  expiresAt: null,
  scopedBucketIds: null,
};

const MOCK_CREATE_RESULT: ApiKeyCreateResult = {
  ...MOCK_API_KEY_RESULT,
  token: "abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
};

const MOCK_PAGINATED_RESULT: PaginatedResult<ApiKeyResult> = {
  items: [MOCK_API_KEY_RESULT],
  nextCursor: null,
  hasMore: false,
  totalCount: null,
};

// ── Tests: CREATE ───────────────────────────────────────────────

describe("POST /systems/:systemId/api-keys", () => {
  beforeEach(() => {
    vi.mocked(createApiKey).mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 201 with created API key including token", async () => {
    vi.mocked(createApiKey).mockResolvedValueOnce(MOCK_CREATE_RESULT);

    const app = createApp();
    const res = await postJSON(app, `/systems/${SYS_ID}/api-keys`, {
      keyType: "metadata",
      scopes: ["read:members"],
      encryptedData: "encrypted-payload",
    });

    expect(res.status).toBe(201);
    const body = (await res.json()) as ApiKeyCreateResult;
    expect(body.id).toBe(AK_ID);
    expect(body.token).toBe(MOCK_CREATE_RESULT.token);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
  });

  it("passes body to service", async () => {
    vi.mocked(createApiKey).mockResolvedValueOnce(MOCK_CREATE_RESULT);

    const app = createApp();
    await postJSON(app, `/systems/${SYS_ID}/api-keys`, {
      keyType: "metadata",
      scopes: ["read:members"],
      encryptedData: "encrypted-payload",
    });

    expect(createApiKey).toHaveBeenCalledTimes(1);
  });

  it("returns 400 for invalid systemId", async () => {
    const app = createApp();
    const res = await postJSON(app, "/systems/bad-id/api-keys", {
      keyType: "metadata",
      scopes: ["read:members"],
      encryptedData: "encrypted-payload",
    });

    expect(res.status).toBe(400);
  });
});

// ── Tests: LIST ─────────────────────────────────────────────────

describe("GET /systems/:systemId/api-keys", () => {
  beforeEach(() => {
    vi.mocked(listApiKeys).mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 200 with paginated result", async () => {
    vi.mocked(listApiKeys).mockResolvedValueOnce(MOCK_PAGINATED_RESULT);

    const app = createApp();
    const res = await app.request(`/systems/${SYS_ID}/api-keys`);

    expect(res.status).toBe(200);
    const body = (await res.json()) as PaginatedResult<ApiKeyResult>;
    expect(body.items).toHaveLength(1);
    expect(body.items[0]?.id).toBe(AK_ID);
    expect(body.hasMore).toBe(false);
  });

  it("returns 400 for invalid systemId", async () => {
    const app = createApp();
    const res = await app.request("/systems/bad-id/api-keys");

    expect(res.status).toBe(400);
  });
});

// ── Tests: GET ──────────────────────────────────────────────────

describe("GET /systems/:systemId/api-keys/:apiKeyId", () => {
  beforeEach(() => {
    vi.mocked(getApiKey).mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 200 with key details (no token)", async () => {
    vi.mocked(getApiKey).mockResolvedValueOnce(MOCK_API_KEY_RESULT);

    const app = createApp();
    const res = await app.request(`/systems/${SYS_ID}/api-keys/${AK_ID}`);

    expect(res.status).toBe(200);
    const body = (await res.json()) as ApiKeyResult;
    expect(body.id).toBe(AK_ID);
    expect(body).not.toHaveProperty("token");
    expect(body).not.toHaveProperty("tokenHash");
  });

  it("returns 400 for invalid apiKeyId", async () => {
    const app = createApp();
    const res = await app.request(`/systems/${SYS_ID}/api-keys/bad-id`);

    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid systemId", async () => {
    const app = createApp();
    const res = await app.request(`/systems/bad-id/api-keys/${AK_ID}`);

    expect(res.status).toBe(400);
  });
});

// ── Tests: REVOKE ───────────────────────────────────────────────

describe("POST /systems/:systemId/api-keys/:apiKeyId/revoke", () => {
  beforeEach(() => {
    vi.mocked(revokeApiKey).mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 204 on successful revocation", async () => {
    vi.mocked(revokeApiKey).mockResolvedValueOnce(undefined);

    const app = createApp();
    const res = await app.request(`/systems/${SYS_ID}/api-keys/${AK_ID}/revoke`, {
      method: "POST",
    });

    expect(res.status).toBe(204);
    expect(revokeApiKey).toHaveBeenCalledTimes(1);
  });

  it("returns 400 for invalid apiKeyId", async () => {
    const app = createApp();
    const res = await app.request(`/systems/${SYS_ID}/api-keys/bad-id/revoke`, {
      method: "POST",
    });

    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid systemId", async () => {
    const app = createApp();
    const res = await app.request(`/systems/bad-id/api-keys/${AK_ID}/revoke`, {
      method: "POST",
    });

    expect(res.status).toBe(400);
  });
});
