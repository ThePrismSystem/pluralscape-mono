import { brandId } from "@pluralscape/types";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  mockAuditWriterFactory,
  mockAuthFactory,
  mockDbFactory,
  mockRateLimitFactory,
  mockSystemOwnershipFactory,
} from "../../helpers/common-route-mocks.js";
import { MOCK_AUTH, createRouteApp, postJSON } from "../../helpers/route-test-setup.js";

import type {
  EntityAssociationResult,
  EntityLinkResult,
  EntityMemberLinkResult,
} from "../../../services/structure-entity.service.js";
import type {
  ApiErrorResponse,
  MemberId,
  PaginatedResult,
  SystemStructureEntityAssociationId,
  SystemStructureEntityId,
  SystemStructureEntityLinkId,
  SystemStructureEntityMemberLinkId,
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
  createEntityLink,
  listEntityLinks,
  deleteEntityLink,
  createEntityMemberLink,
  listEntityMemberLinks,
  deleteEntityMemberLink,
  createEntityAssociation,
  listEntityAssociations,
  deleteEntityAssociation,
} = await import("../../../services/structure-entity.service.js");
const { ApiHttpError } = await import("../../../lib/api-error.js");
const { systemRoutes } = await import("../../../routes/systems/index.js");

// ── Helpers ──────────────────────────────────────────────────────

const SYS_ID = "sys_550e8400-e29b-41d4-a716-446655440000";
const LINK_ID = brandId<SystemStructureEntityLinkId>("stel_550e8400-e29b-41d4-a716-446655440000");
const ML_ID = brandId<SystemStructureEntityMemberLinkId>(
  "steml_550e8400-e29b-41d4-a716-446655440000",
);
const ASSOC_ID = brandId<SystemStructureEntityAssociationId>(
  "stea_550e8400-e29b-41d4-a716-446655440000",
);
const ENTITY_ID = brandId<SystemStructureEntityId>("ste_550e8400-e29b-41d4-a716-446655440000");
const MEMBER_ID = brandId<MemberId>("mem_550e8400-e29b-41d4-a716-446655440000");

const createApp = () => createRouteApp("/systems", systemRoutes);

// ── Entity Links ─────────────────────────────────────────────────

const LINKS_BASE = `/systems/${SYS_ID}/structure/entity-links`;

const MOCK_LINK: EntityLinkResult = {
  id: LINK_ID,
  systemId: SYS_ID as never,
  entityId: ENTITY_ID,
  parentEntityId: null,
  sortOrder: 0,
  createdAt: 1000 as never,
};

const EMPTY_LINK_PAGE: PaginatedResult<EntityLinkResult> = {
  data: [],
  nextCursor: null,
  hasMore: false,
  totalCount: null,
};

describe("POST /systems/:systemId/structure/entity-links", () => {
  beforeEach(() => {
    vi.mocked(createEntityLink).mockReset();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 201 on success", async () => {
    vi.mocked(createEntityLink).mockResolvedValueOnce(MOCK_LINK);
    const app = createApp();
    const res = await postJSON(app, LINKS_BASE, {
      entityId: ENTITY_ID,
      parentEntityId: null,
      sortOrder: 0,
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as { data: EntityLinkResult };
    expect(body.data.id).toBe(LINK_ID);
  });

  it("forwards params to service", async () => {
    vi.mocked(createEntityLink).mockResolvedValueOnce(MOCK_LINK);
    const app = createApp();
    const payload = { entityId: ENTITY_ID, parentEntityId: null, sortOrder: 0 };
    await postJSON(app, LINKS_BASE, payload);
    expect(vi.mocked(createEntityLink)).toHaveBeenCalledWith(
      expect.anything(),
      SYS_ID,
      payload,
      MOCK_AUTH,
      expect.any(Function),
    );
  });
});

describe("GET /systems/:systemId/structure/entity-links", () => {
  beforeEach(() => {
    vi.mocked(listEntityLinks).mockReset();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 200 with empty list", async () => {
    vi.mocked(listEntityLinks).mockResolvedValueOnce(EMPTY_LINK_PAGE);
    const app = createApp();
    const res = await app.request(LINKS_BASE);
    expect(res.status).toBe(200);
    const body = (await res.json()) as PaginatedResult<EntityLinkResult>;
    expect(body.data).toEqual([]);
  });
});

describe("DELETE /systems/:systemId/structure/entity-links/:linkId", () => {
  beforeEach(() => {
    vi.mocked(deleteEntityLink).mockReset();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 204 on success", async () => {
    vi.mocked(deleteEntityLink).mockResolvedValueOnce(undefined);
    const app = createApp();
    const res = await app.request(`${LINKS_BASE}/${LINK_ID}`, { method: "DELETE" });
    expect(res.status).toBe(204);
  });

  it("returns 404 when entity link not found", async () => {
    vi.mocked(deleteEntityLink).mockRejectedValueOnce(
      new ApiHttpError(404, "NOT_FOUND", "Structure entity link not found"),
    );
    const app = createApp();
    const res = await app.request(`${LINKS_BASE}/${LINK_ID}`, { method: "DELETE" });
    expect(res.status).toBe(404);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("NOT_FOUND");
  });

  it("returns 400 for invalid link ID", async () => {
    const app = createApp();
    const res = await app.request(`${LINKS_BASE}/bad-id`, { method: "DELETE" });
    expect(res.status).toBe(400);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });
});

// ── Entity Member Links ──────────────────────────────────────────

const ML_BASE = `/systems/${SYS_ID}/structure/entity-member-links`;

const MOCK_MEMBER_LINK: EntityMemberLinkResult = {
  id: ML_ID,
  systemId: SYS_ID as never,
  parentEntityId: ENTITY_ID,
  memberId: MEMBER_ID,
  sortOrder: 0,
  createdAt: 1000 as never,
};

const EMPTY_ML_PAGE: PaginatedResult<EntityMemberLinkResult> = {
  data: [],
  nextCursor: null,
  hasMore: false,
  totalCount: null,
};

describe("POST /systems/:systemId/structure/entity-member-links", () => {
  beforeEach(() => {
    vi.mocked(createEntityMemberLink).mockReset();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 201 on success", async () => {
    vi.mocked(createEntityMemberLink).mockResolvedValueOnce(MOCK_MEMBER_LINK);
    const app = createApp();
    const res = await postJSON(app, ML_BASE, {
      parentEntityId: ENTITY_ID,
      memberId: MEMBER_ID,
      sortOrder: 0,
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as { data: EntityMemberLinkResult };
    expect(body.data.id).toBe(ML_ID);
  });
});

describe("GET /systems/:systemId/structure/entity-member-links", () => {
  beforeEach(() => {
    vi.mocked(listEntityMemberLinks).mockReset();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 200 with empty list", async () => {
    vi.mocked(listEntityMemberLinks).mockResolvedValueOnce(EMPTY_ML_PAGE);
    const app = createApp();
    const res = await app.request(ML_BASE);
    expect(res.status).toBe(200);
    const body = (await res.json()) as PaginatedResult<EntityMemberLinkResult>;
    expect(body.data).toEqual([]);
  });
});

describe("DELETE /systems/:systemId/structure/entity-member-links/:linkId", () => {
  beforeEach(() => {
    vi.mocked(deleteEntityMemberLink).mockReset();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 204 on success", async () => {
    vi.mocked(deleteEntityMemberLink).mockResolvedValueOnce(undefined);
    const app = createApp();
    const res = await app.request(`${ML_BASE}/${ML_ID}`, { method: "DELETE" });
    expect(res.status).toBe(204);
  });

  it("returns 404 when entity member link not found", async () => {
    vi.mocked(deleteEntityMemberLink).mockRejectedValueOnce(
      new ApiHttpError(404, "NOT_FOUND", "Structure entity member link not found"),
    );
    const app = createApp();
    const res = await app.request(`${ML_BASE}/${ML_ID}`, { method: "DELETE" });
    expect(res.status).toBe(404);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("NOT_FOUND");
  });

  it("returns 400 for invalid link ID", async () => {
    const app = createApp();
    const res = await app.request(`${ML_BASE}/bad-id`, { method: "DELETE" });
    expect(res.status).toBe(400);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });
});

// ── Entity Associations ──────────────────────────────────────────

const ASSOC_BASE = `/systems/${SYS_ID}/structure/entity-associations`;

const MOCK_ASSOC: EntityAssociationResult = {
  id: ASSOC_ID,
  systemId: SYS_ID as never,
  sourceEntityId: ENTITY_ID,
  targetEntityId: brandId<SystemStructureEntityId>("ste_660e8400-e29b-41d4-a716-446655440000"),
  createdAt: 1000 as never,
};

const EMPTY_ASSOC_PAGE: PaginatedResult<EntityAssociationResult> = {
  data: [],
  nextCursor: null,
  hasMore: false,
  totalCount: null,
};

describe("POST /systems/:systemId/structure/entity-associations", () => {
  beforeEach(() => {
    vi.mocked(createEntityAssociation).mockReset();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 201 on success", async () => {
    vi.mocked(createEntityAssociation).mockResolvedValueOnce(MOCK_ASSOC);
    const app = createApp();
    const res = await postJSON(app, ASSOC_BASE, {
      sourceEntityId: ENTITY_ID,
      targetEntityId: "ste_660e8400-e29b-41d4-a716-446655440000",
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as { data: EntityAssociationResult };
    expect(body.data.id).toBe(ASSOC_ID);
  });
});

describe("GET /systems/:systemId/structure/entity-associations", () => {
  beforeEach(() => {
    vi.mocked(listEntityAssociations).mockReset();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 200 with empty list", async () => {
    vi.mocked(listEntityAssociations).mockResolvedValueOnce(EMPTY_ASSOC_PAGE);
    const app = createApp();
    const res = await app.request(ASSOC_BASE);
    expect(res.status).toBe(200);
    const body = (await res.json()) as PaginatedResult<EntityAssociationResult>;
    expect(body.data).toEqual([]);
  });
});

describe("DELETE /systems/:systemId/structure/entity-associations/:associationId", () => {
  beforeEach(() => {
    vi.mocked(deleteEntityAssociation).mockReset();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 204 on success", async () => {
    vi.mocked(deleteEntityAssociation).mockResolvedValueOnce(undefined);
    const app = createApp();
    const res = await app.request(`${ASSOC_BASE}/${ASSOC_ID}`, { method: "DELETE" });
    expect(res.status).toBe(204);
  });

  it("returns 404 when entity association not found", async () => {
    vi.mocked(deleteEntityAssociation).mockRejectedValueOnce(
      new ApiHttpError(404, "NOT_FOUND", "Structure entity association not found"),
    );
    const app = createApp();
    const res = await app.request(`${ASSOC_BASE}/${ASSOC_ID}`, { method: "DELETE" });
    expect(res.status).toBe(404);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("NOT_FOUND");
  });

  it("returns 400 for invalid association ID", async () => {
    const app = createApp();
    const res = await app.request(`${ASSOC_BASE}/bad-id`, { method: "DELETE" });
    expect(res.status).toBe(400);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });
});
