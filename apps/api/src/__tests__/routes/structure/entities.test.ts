import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  mockAuditWriterFactory,
  mockAuthFactory,
  mockDbFactory,
  mockRateLimitFactory,
  mockSystemOwnershipFactory,
} from "../../helpers/common-route-mocks.js";
import { MOCK_AUTH, createRouteApp, postJSON, putJSON } from "../../helpers/route-test-setup.js";

import type {
  HierarchyNode,
  StructureEntityResult,
} from "../../../services/structure-entity.service.js";
import type {
  ApiErrorResponse,
  PaginatedResult,
  SystemStructureEntityId,
  SystemStructureEntityTypeId,
} from "@pluralscape/types";

// ── Mocks ────────────────────────────────────────────────────────

vi.mock("../../../services/structure-entity.service.js", () => ({
  createEntityType: vi.fn(),
  listEntityTypes: vi.fn(),
  getEntityType: vi.fn(),
  updateEntityType: vi.fn(),
  archiveEntityType: vi.fn(),
  restoreEntityType: vi.fn(),
  deleteEntityType: vi.fn(),
  createStructureEntity: vi.fn(),
  listStructureEntities: vi.fn(),
  getStructureEntity: vi.fn(),
  updateStructureEntity: vi.fn(),
  archiveStructureEntity: vi.fn(),
  restoreStructureEntity: vi.fn(),
  deleteStructureEntity: vi.fn(),
  getEntityHierarchy: vi.fn(),
  createEntityLink: vi.fn(),
  listEntityLinks: vi.fn(),
  deleteEntityLink: vi.fn(),
  createEntityMemberLink: vi.fn(),
  listEntityMemberLinks: vi.fn(),
  deleteEntityMemberLink: vi.fn(),
  createEntityAssociation: vi.fn(),
  listEntityAssociations: vi.fn(),
  deleteEntityAssociation: vi.fn(),
}));

vi.mock("../../../lib/audit-writer.js", () => mockAuditWriterFactory());
vi.mock("../../../lib/db.js", () => mockDbFactory());
vi.mock("../../../middleware/rate-limit.js", () => mockRateLimitFactory());
vi.mock("../../../lib/system-ownership.js", () => mockSystemOwnershipFactory());
vi.mock("../../../middleware/auth.js", () => mockAuthFactory());

// ── Imports after mocks ──────────────────────────────────────────

const {
  createStructureEntity,
  listStructureEntities,
  getStructureEntity,
  updateStructureEntity,
  archiveStructureEntity,
  restoreStructureEntity,
  deleteStructureEntity,
  getEntityHierarchy,
} = await import("../../../services/structure-entity.service.js");
const { ApiHttpError } = await import("../../../lib/api-error.js");
const { systemRoutes } = await import("../../../routes/systems/index.js");

// ── Helpers ──────────────────────────────────────────────────────

const SYS_ID = "sys_550e8400-e29b-41d4-a716-446655440000";
const ENTITY_ID = "ste_550e8400-e29b-41d4-a716-446655440000" as SystemStructureEntityId;
const ET_ID = "stet_550e8400-e29b-41d4-a716-446655440000" as SystemStructureEntityTypeId;
const BASE = `/systems/${SYS_ID}/structure/entities`;

const createApp = () => createRouteApp("/systems", systemRoutes);

const MOCK_ENTITY: StructureEntityResult = {
  id: ENTITY_ID,
  systemId: SYS_ID as never,
  entityTypeId: ET_ID,
  sortOrder: 0,
  encryptedData: "dGVzdA==",
  version: 1,
  archived: false,
  archivedAt: null,
  createdAt: 1000 as never,
  updatedAt: 1000 as never,
};

const EMPTY_PAGE: PaginatedResult<StructureEntityResult> = {
  data: [],
  nextCursor: null,
  hasMore: false,
  totalCount: null,
};

// ── Tests ────────────────────────────────────────────────────────

describe("POST /systems/:systemId/structure/entities", () => {
  beforeEach(() => {
    vi.mocked(createStructureEntity).mockReset();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 201 with new entity on success", async () => {
    vi.mocked(createStructureEntity).mockResolvedValueOnce(MOCK_ENTITY);
    const app = createApp();
    const res = await postJSON(app, BASE, {
      structureEntityTypeId: ET_ID,
      encryptedData: "dGVzdA==",
      parentEntityId: null,
      sortOrder: 0,
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as StructureEntityResult;
    expect(body.id).toBe(ENTITY_ID);
  });

  it("forwards params to service", async () => {
    vi.mocked(createStructureEntity).mockResolvedValueOnce(MOCK_ENTITY);
    const app = createApp();
    const payload = {
      structureEntityTypeId: ET_ID,
      encryptedData: "dGVzdA==",
      parentEntityId: null,
      sortOrder: 0,
    };
    await postJSON(app, BASE, payload);

    expect(vi.mocked(createStructureEntity)).toHaveBeenCalledWith(
      expect.anything(),
      SYS_ID,
      payload,
      MOCK_AUTH,
      expect.any(Function),
    );
  });

  it("returns 400 for invalid system ID", async () => {
    const app = createApp();
    const res = await postJSON(app, "/systems/bad-id/structure/entities", {});
    expect(res.status).toBe(400);
  });
});

describe("GET /systems/:systemId/structure/entities", () => {
  beforeEach(() => {
    vi.mocked(listStructureEntities).mockReset();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 200 with empty list", async () => {
    vi.mocked(listStructureEntities).mockResolvedValueOnce(EMPTY_PAGE);
    const app = createApp();
    const res = await app.request(BASE);
    expect(res.status).toBe(200);
    const body = (await res.json()) as PaginatedResult<StructureEntityResult>;
    expect(body.data).toEqual([]);
  });

  it("forwards entityTypeId filter to service", async () => {
    vi.mocked(listStructureEntities).mockResolvedValueOnce(EMPTY_PAGE);
    const app = createApp();
    await app.request(`${BASE}?entityTypeId=${ET_ID}`);
    expect(vi.mocked(listStructureEntities)).toHaveBeenCalledWith(
      expect.anything(),
      SYS_ID,
      MOCK_AUTH,
      expect.objectContaining({ entityTypeId: ET_ID }),
    );
  });
});

describe("GET /systems/:systemId/structure/entities/:entityId", () => {
  beforeEach(() => {
    vi.mocked(getStructureEntity).mockReset();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 200 with entity", async () => {
    vi.mocked(getStructureEntity).mockResolvedValueOnce(MOCK_ENTITY);
    const app = createApp();
    const res = await app.request(`${BASE}/${ENTITY_ID}`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as StructureEntityResult;
    expect(body.id).toBe(ENTITY_ID);
  });

  it("returns 404 when entity not found", async () => {
    vi.mocked(getStructureEntity).mockRejectedValueOnce(
      new ApiHttpError(404, "NOT_FOUND", "Structure entity not found"),
    );
    const app = createApp();
    const res = await app.request(`${BASE}/${ENTITY_ID}`);
    expect(res.status).toBe(404);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("NOT_FOUND");
  });

  it("returns 400 for invalid entity ID format", async () => {
    const app = createApp();
    const res = await app.request(`${BASE}/bad-id`);
    expect(res.status).toBe(400);
  });
});

describe("PUT /systems/:systemId/structure/entities/:entityId", () => {
  beforeEach(() => {
    vi.mocked(updateStructureEntity).mockReset();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 200 with updated entity", async () => {
    vi.mocked(updateStructureEntity).mockResolvedValueOnce({ ...MOCK_ENTITY, version: 2 });
    const app = createApp();
    const res = await putJSON(app, `${BASE}/${ENTITY_ID}`, {
      encryptedData: "dGVzdA==",
      parentEntityId: null,
      sortOrder: 0,
      version: 1,
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as StructureEntityResult;
    expect(body.version).toBe(2);
  });
});

describe("POST /systems/:systemId/structure/entities/:entityId/archive", () => {
  beforeEach(() => {
    vi.mocked(archiveStructureEntity).mockReset();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 204 on success", async () => {
    vi.mocked(archiveStructureEntity).mockResolvedValueOnce(undefined);
    const app = createApp();
    const res = await app.request(`${BASE}/${ENTITY_ID}/archive`, { method: "POST" });
    expect(res.status).toBe(204);
  });
});

describe("POST /systems/:systemId/structure/entities/:entityId/restore", () => {
  beforeEach(() => {
    vi.mocked(restoreStructureEntity).mockReset();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 200 with restored entity", async () => {
    vi.mocked(restoreStructureEntity).mockResolvedValueOnce(MOCK_ENTITY);
    const app = createApp();
    const res = await app.request(`${BASE}/${ENTITY_ID}/restore`, { method: "POST" });
    expect(res.status).toBe(200);
    const body = (await res.json()) as StructureEntityResult;
    expect(body.id).toBe(ENTITY_ID);
  });
});

describe("DELETE /systems/:systemId/structure/entities/:entityId", () => {
  beforeEach(() => {
    vi.mocked(deleteStructureEntity).mockReset();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 204 on success", async () => {
    vi.mocked(deleteStructureEntity).mockResolvedValueOnce(undefined);
    const app = createApp();
    const res = await app.request(`${BASE}/${ENTITY_ID}`, { method: "DELETE" });
    expect(res.status).toBe(204);
  });

  it("returns 404 when entity not found", async () => {
    vi.mocked(deleteStructureEntity).mockRejectedValueOnce(
      new ApiHttpError(404, "NOT_FOUND", "Structure entity not found"),
    );
    const app = createApp();
    const res = await app.request(`${BASE}/${ENTITY_ID}`, { method: "DELETE" });
    expect(res.status).toBe(404);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("NOT_FOUND");
  });

  it("returns 409 when entity has dependents", async () => {
    vi.mocked(deleteStructureEntity).mockRejectedValueOnce(
      new ApiHttpError(
        409,
        "HAS_DEPENDENTS",
        "Structure entity has dependents. Remove all links and associations before deleting.",
        { dependents: [{ type: "entityLinks", count: 2 }] },
      ),
    );
    const app = createApp();
    const res = await app.request(`${BASE}/${ENTITY_ID}`, { method: "DELETE" });
    expect(res.status).toBe(409);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("HAS_DEPENDENTS");
  });

  it("returns 400 for invalid entity ID", async () => {
    const app = createApp();
    const res = await app.request(`${BASE}/bad-id`, { method: "DELETE" });
    expect(res.status).toBe(400);
  });
});

describe("GET /systems/:systemId/structure/entities/:entityId/hierarchy", () => {
  beforeEach(() => {
    vi.mocked(getEntityHierarchy).mockReset();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 200 with hierarchy nodes", async () => {
    const nodes: readonly HierarchyNode[] = [
      { entityId: ENTITY_ID, parentEntityId: null, depth: 1 },
    ];
    vi.mocked(getEntityHierarchy).mockResolvedValueOnce(nodes);
    const app = createApp();
    const res = await app.request(`${BASE}/${ENTITY_ID}/hierarchy`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: HierarchyNode[] };
    expect(body.data).toHaveLength(1);
    const first = body.data[0];
    expect(first).toBeDefined();
    expect(first?.entityId).toBe(ENTITY_ID);
  });

  it("forwards entityId and systemId to service", async () => {
    vi.mocked(getEntityHierarchy).mockResolvedValueOnce([]);
    const app = createApp();
    await app.request(`${BASE}/${ENTITY_ID}/hierarchy`);
    expect(vi.mocked(getEntityHierarchy)).toHaveBeenCalledWith(
      expect.anything(),
      SYS_ID,
      ENTITY_ID,
      MOCK_AUTH,
    );
  });
});
