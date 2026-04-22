import { brandId } from "@pluralscape/types";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  mockAuditWriterFactory,
  mockAuthFactory,
  mockDbFactory,
  mockRateLimitFactory,
  mockSystemOwnershipFactory,
} from "../../helpers/common-route-mocks.js";
import { MOCK_AUTH, createRouteApp, postJSON, putJSON } from "../../helpers/route-test-setup.js";

import type { EntityTypeResult } from "../../../services/structure/entity-type/internal.js";
import type {
  ApiErrorResponse,
  PaginatedResult,
  SystemStructureEntityTypeId,
} from "@pluralscape/types";

// ── Mocks ────────────────────────────────────────────────────────

vi.mock("../../../services/structure/entity-type/create.js", () => ({
  createEntityType: vi.fn(),
}));
vi.mock("../../../services/structure/entity-type/list.js", () => ({
  listEntityTypes: vi.fn(),
}));
vi.mock("../../../services/structure/entity-type/get.js", () => ({
  getEntityType: vi.fn(),
}));
vi.mock("../../../services/structure/entity-type/update.js", () => ({
  updateEntityType: vi.fn(),
}));
vi.mock("../../../services/structure/entity-type/archive.js", () => ({
  archiveEntityType: vi.fn(),
}));
vi.mock("../../../services/structure/entity-type/restore.js", () => ({
  restoreEntityType: vi.fn(),
}));
vi.mock("../../../services/structure/entity-type/delete.js", () => ({
  deleteEntityType: vi.fn(),
}));

vi.mock("../../../lib/audit-writer.js", () => mockAuditWriterFactory());
vi.mock("../../../lib/db.js", () => mockDbFactory());
vi.mock("../../../middleware/rate-limit.js", () => mockRateLimitFactory());
vi.mock("../../../lib/system-ownership.js", () => mockSystemOwnershipFactory());
vi.mock("../../../middleware/auth.js", () => mockAuthFactory());
// ── Imports after mocks ──────────────────────────────────────────

const { createEntityType } = await import("../../../services/structure/entity-type/create.js");
const { listEntityTypes } = await import("../../../services/structure/entity-type/list.js");
const { getEntityType } = await import("../../../services/structure/entity-type/get.js");
const { updateEntityType } = await import("../../../services/structure/entity-type/update.js");
const { archiveEntityType } = await import("../../../services/structure/entity-type/archive.js");
const { restoreEntityType } = await import("../../../services/structure/entity-type/restore.js");
const { deleteEntityType } = await import("../../../services/structure/entity-type/delete.js");
const { createAuditWriter } = await import("../../../lib/audit-writer.js");
const { ApiHttpError } = await import("../../../lib/api-error.js");
const { systemRoutes } = await import("../../../routes/systems/index.js");

// ── Helpers ──────────────────────────────────────────────────────

const SYS_ID = "sys_550e8400-e29b-41d4-a716-446655440000";
const ET_ID = brandId<SystemStructureEntityTypeId>("stet_550e8400-e29b-41d4-a716-446655440000");
const BASE = `/systems/${SYS_ID}/structure/entity-types`;

const createApp = () => createRouteApp("/systems", systemRoutes);

const MOCK_ENTITY_TYPE: EntityTypeResult = {
  id: ET_ID,
  systemId: SYS_ID as never,
  sortOrder: 0,
  encryptedData: "dGVzdA==",
  version: 1,
  archived: false,
  archivedAt: null,
  createdAt: 1000 as never,
  updatedAt: 1000 as never,
};

const EMPTY_PAGE: PaginatedResult<EntityTypeResult> = {
  data: [],
  nextCursor: null,
  hasMore: false,
  totalCount: null,
};

// ── Tests ────────────────────────────────────────────────────────

describe("POST /systems/:systemId/structure/entity-types", () => {
  beforeEach(() => {
    vi.mocked(createEntityType).mockReset();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 201 with new entity type on success", async () => {
    vi.mocked(createEntityType).mockResolvedValueOnce(MOCK_ENTITY_TYPE);
    const app = createApp();
    const res = await postJSON(app, BASE, { encryptedData: "dGVzdA==", sortOrder: 0 });
    expect(res.status).toBe(201);
    const body = (await res.json()) as { data: EntityTypeResult };
    expect(body.data.id).toBe(ET_ID);
  });

  it("forwards systemId, body, auth, and audit to service", async () => {
    vi.mocked(createEntityType).mockResolvedValueOnce(MOCK_ENTITY_TYPE);
    const app = createApp();
    const payload = { encryptedData: "dGVzdA==", sortOrder: 0 };
    await postJSON(app, BASE, payload);

    expect(vi.mocked(createEntityType)).toHaveBeenCalledWith(
      expect.anything(),
      SYS_ID,
      payload,
      MOCK_AUTH,
      expect.any(Function),
    );
    expect(vi.mocked(createAuditWriter)).toHaveBeenCalledWith(expect.anything(), MOCK_AUTH);
  });

  it("returns 400 for invalid system ID", async () => {
    const app = createApp();
    const res = await postJSON(app, "/systems/not-valid/structure/entity-types", {
      encryptedData: "dGVzdA==",
      sortOrder: 0,
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 400 for malformed JSON body", async () => {
    const app = createApp();
    const res = await app.request(BASE, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not valid json{{{",
    });
    expect(res.status).toBe(400);
  });

  it("re-throws unexpected errors as 500", async () => {
    vi.mocked(createEntityType).mockRejectedValueOnce(new Error("DB timeout"));
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const app = createApp();
    const res = await postJSON(app, BASE, { encryptedData: "dGVzdA==", sortOrder: 0 });
    expect(res.status).toBe(500);
  });
});

describe("GET /systems/:systemId/structure/entity-types", () => {
  beforeEach(() => {
    vi.mocked(listEntityTypes).mockReset();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 200 with empty list", async () => {
    vi.mocked(listEntityTypes).mockResolvedValueOnce(EMPTY_PAGE);
    const app = createApp();
    const res = await app.request(BASE);
    expect(res.status).toBe(200);
    const body = (await res.json()) as PaginatedResult<EntityTypeResult>;
    expect(body.data).toEqual([]);
    expect(body.hasMore).toBe(false);
  });

  it("forwards limit, cursor, and includeArchived to service", async () => {
    vi.mocked(listEntityTypes).mockResolvedValueOnce(EMPTY_PAGE);
    const app = createApp();
    await app.request(`${BASE}?limit=10&includeArchived=true`);
    expect(vi.mocked(listEntityTypes)).toHaveBeenCalledWith(expect.anything(), SYS_ID, MOCK_AUTH, {
      cursor: undefined,
      limit: 10,
      includeArchived: true,
    });
  });

  it("caps limit to MAX_ENTITY_TYPE_LIMIT", async () => {
    vi.mocked(listEntityTypes).mockResolvedValueOnce(EMPTY_PAGE);
    const app = createApp();
    await app.request(`${BASE}?limit=999`);
    expect(vi.mocked(listEntityTypes)).toHaveBeenCalledWith(expect.anything(), SYS_ID, MOCK_AUTH, {
      cursor: undefined,
      limit: 100,
      includeArchived: false,
    });
  });
});

describe("GET /systems/:systemId/structure/entity-types/:entityTypeId", () => {
  beforeEach(() => {
    vi.mocked(getEntityType).mockReset();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 200 with entity type", async () => {
    vi.mocked(getEntityType).mockResolvedValueOnce(MOCK_ENTITY_TYPE);
    const app = createApp();
    const res = await app.request(`${BASE}/${ET_ID}`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: EntityTypeResult };
    expect(body.data.id).toBe(ET_ID);
  });

  it("returns 404 when entity type not found", async () => {
    vi.mocked(getEntityType).mockRejectedValueOnce(
      new ApiHttpError(404, "NOT_FOUND", "Structure entity type not found"),
    );
    const app = createApp();
    const res = await app.request(`${BASE}/${ET_ID}`);
    expect(res.status).toBe(404);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("NOT_FOUND");
  });

  it("returns 400 for invalid entity type ID format", async () => {
    const app = createApp();
    const res = await app.request(`${BASE}/bad-id`);
    expect(res.status).toBe(400);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });
});

describe("PUT /systems/:systemId/structure/entity-types/:entityTypeId", () => {
  beforeEach(() => {
    vi.mocked(updateEntityType).mockReset();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 200 with updated entity type", async () => {
    const updated = { ...MOCK_ENTITY_TYPE, version: 2 };
    vi.mocked(updateEntityType).mockResolvedValueOnce(updated);
    const app = createApp();
    const res = await putJSON(app, `${BASE}/${ET_ID}`, {
      encryptedData: "dGVzdA==",
      sortOrder: 1,
      version: 1,
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: EntityTypeResult };
    expect(body.data.version).toBe(2);
  });

  it("forwards entityTypeId to service", async () => {
    vi.mocked(updateEntityType).mockResolvedValueOnce(MOCK_ENTITY_TYPE);
    const app = createApp();
    await putJSON(app, `${BASE}/${ET_ID}`, {
      encryptedData: "dGVzdA==",
      sortOrder: 0,
      version: 1,
    });
    expect(vi.mocked(updateEntityType)).toHaveBeenCalledWith(
      expect.anything(),
      SYS_ID,
      ET_ID,
      expect.anything(),
      MOCK_AUTH,
      expect.any(Function),
    );
  });
});

describe("POST /systems/:systemId/structure/entity-types/:entityTypeId/archive", () => {
  beforeEach(() => {
    vi.mocked(archiveEntityType).mockReset();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 204 on success", async () => {
    vi.mocked(archiveEntityType).mockResolvedValueOnce(undefined);
    const app = createApp();
    const res = await app.request(`${BASE}/${ET_ID}/archive`, { method: "POST" });
    expect(res.status).toBe(204);
  });
});

describe("POST /systems/:systemId/structure/entity-types/:entityTypeId/restore", () => {
  beforeEach(() => {
    vi.mocked(restoreEntityType).mockReset();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 200 with restored entity type", async () => {
    vi.mocked(restoreEntityType).mockResolvedValueOnce(MOCK_ENTITY_TYPE);
    const app = createApp();
    const res = await app.request(`${BASE}/${ET_ID}/restore`, { method: "POST" });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: EntityTypeResult };
    expect(body.data.id).toBe(ET_ID);
  });
});

describe("DELETE /systems/:systemId/structure/entity-types/:entityTypeId", () => {
  beforeEach(() => {
    vi.mocked(deleteEntityType).mockReset();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 204 on success", async () => {
    vi.mocked(deleteEntityType).mockResolvedValueOnce(undefined);
    const app = createApp();
    const res = await app.request(`${BASE}/${ET_ID}`, { method: "DELETE" });
    expect(res.status).toBe(204);
  });

  it("returns 404 when entity type not found", async () => {
    vi.mocked(deleteEntityType).mockRejectedValueOnce(
      new ApiHttpError(404, "NOT_FOUND", "Structure entity type not found"),
    );
    const app = createApp();
    const res = await app.request(`${BASE}/${ET_ID}`, { method: "DELETE" });
    expect(res.status).toBe(404);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("NOT_FOUND");
  });

  it("returns 409 when entity type has dependent entities", async () => {
    vi.mocked(deleteEntityType).mockRejectedValueOnce(
      new ApiHttpError(
        409,
        "HAS_DEPENDENTS",
        "Structure entity type has 3 entity(s). Remove all entities before deleting.",
        { dependents: [{ type: "structureEntities", count: 3 }] },
      ),
    );
    const app = createApp();
    const res = await app.request(`${BASE}/${ET_ID}`, { method: "DELETE" });
    expect(res.status).toBe(409);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("HAS_DEPENDENTS");
  });

  it("returns 400 for invalid entity type ID", async () => {
    const app = createApp();
    const res = await app.request(`${BASE}/bad-id`, { method: "DELETE" });
    expect(res.status).toBe(400);
  });
});
