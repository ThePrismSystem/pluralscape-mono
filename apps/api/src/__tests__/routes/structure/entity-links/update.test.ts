import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  mockAuditWriterFactory,
  mockAuthFactory,
  mockDbFactory,
  mockRateLimitFactory,
} from "../../../helpers/common-route-mocks.js";
import { createRouteApp, putJSON } from "../../../helpers/route-test-setup.js";

import type { ApiErrorResponse } from "@pluralscape/types";

// ── Mocks ────────────────────────────────────────────────────────

vi.mock("../../../../services/structure-entity-link.service.js", () => ({
  updateEntityLink: vi.fn(),
  createEntityLink: vi.fn(),
  deleteEntityLink: vi.fn(),
  listEntityLinks: vi.fn(),
}));
vi.mock("../../../../services/structure-entity-type.service.js", () => ({
  createEntityType: vi.fn(),
  listEntityTypes: vi.fn(),
  getEntityType: vi.fn(),
  updateEntityType: vi.fn(),
  deleteEntityType: vi.fn(),
}));
vi.mock("../../../../services/structure/entity-crud/create.js", () => ({
  createStructureEntity: vi.fn(),
}));
vi.mock("../../../../services/structure/entity-crud/queries.js", () => ({
  listStructureEntities: vi.fn(),
  getStructureEntity: vi.fn(),
}));
vi.mock("../../../../services/structure/entity-crud/update.js", () => ({
  updateStructureEntity: vi.fn(),
}));
vi.mock("../../../../services/structure/entity-crud/lifecycle.js", () => ({
  archiveStructureEntity: vi.fn(),
  restoreStructureEntity: vi.fn(),
  deleteStructureEntity: vi.fn(),
}));
vi.mock("../../../../services/structure-entity-member-link.service.js", () => ({
  createEntityMemberLink: vi.fn(),
  deleteEntityMemberLink: vi.fn(),
  listEntityMemberLinks: vi.fn(),
}));
vi.mock("../../../../services/structure-entity-association.service.js", () => ({
  createEntityAssociation: vi.fn(),
  deleteEntityAssociation: vi.fn(),
  listEntityAssociations: vi.fn(),
}));
vi.mock("../../../../lib/audit-writer.js", () => mockAuditWriterFactory());
vi.mock("../../../../lib/db.js", () => mockDbFactory());
vi.mock("../../../../middleware/rate-limit.js", () => mockRateLimitFactory());
vi.mock("../../../../middleware/auth.js", () => mockAuthFactory());
// ── Imports after mocks ──────────────────────────────────────────

const { updateEntityLink } = await import("../../../../services/structure-entity-link.service.js");
const { systemRoutes } = await import("../../../../routes/systems/index.js");

// ── Helpers ──────────────────────────────────────────────────────

const SYS_ID = "sys_550e8400-e29b-41d4-a716-446655440000";
const LINK_ID = "stel_770e8400-e29b-41d4-a716-446655440000";
const BASE_URL = `/systems/${SYS_ID}/structure/entity-links/${LINK_ID}`;

const createApp = () => createRouteApp("/systems", systemRoutes);

// ── Tests ────────────────────────────────────────────────────────

describe("PUT /systems/:systemId/structure/entity-links/:linkId", () => {
  beforeEach(() => {
    vi.mocked(updateEntityLink).mockReset();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 200 with updated link on success", async () => {
    vi.mocked(updateEntityLink).mockResolvedValueOnce({
      id: LINK_ID as never,
      systemId: SYS_ID as never,
      entityId: "se_aaa" as never,
      parentEntityId: null,
      sortOrder: 5,
      createdAt: 1000 as never,
    });

    const app = createApp();
    const res = await putJSON(app, BASE_URL, { sortOrder: 5 });

    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { sortOrder: number } };
    expect(body.data.sortOrder).toBe(5);
  });

  it("returns 404 when not found", async () => {
    const { ApiHttpError } = await import("../../../../lib/api-error.js");
    vi.mocked(updateEntityLink).mockRejectedValueOnce(
      new ApiHttpError(404, "NOT_FOUND", "Entity link not found"),
    );

    const app = createApp();
    const res = await putJSON(app, BASE_URL, { sortOrder: 5 });

    expect(res.status).toBe(404);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("NOT_FOUND");
  });
});
