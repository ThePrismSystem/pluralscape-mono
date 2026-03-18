import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  mockAuditWriterFactory,
  mockAuthFactory,
  mockDbFactory,
  mockRateLimitFactory,
} from "../helpers/common-route-mocks.js";
import { createRouteApp, postJSON } from "../helpers/route-test-setup.js";

import type { ApiErrorResponse } from "@pluralscape/types";

// ── Mocks ────────────────────────────────────────────────────────

vi.mock("../../services/structure-link.service.js", () => ({
  createSubsystemLayerLink: vi.fn(),
  deleteSubsystemLayerLink: vi.fn(),
  listSubsystemLayerLinks: vi.fn(),
  createSubsystemSideSystemLink: vi.fn(),
  deleteSubsystemSideSystemLink: vi.fn(),
  listSubsystemSideSystemLinks: vi.fn(),
  createSideSystemLayerLink: vi.fn(),
  deleteSideSystemLayerLink: vi.fn(),
  listSideSystemLayerLinks: vi.fn(),
}));

vi.mock("../../lib/audit-writer.js", () => mockAuditWriterFactory());

vi.mock("../../lib/db.js", () => mockDbFactory());

vi.mock("../../middleware/rate-limit.js", () => mockRateLimitFactory());

vi.mock("../../middleware/auth.js", () => mockAuthFactory());

// ── Imports after mocks ──────────────────────────────────────────

const {
  createSubsystemLayerLink,
  deleteSubsystemLayerLink,
  listSubsystemLayerLinks,
  createSubsystemSideSystemLink,
  deleteSubsystemSideSystemLink,
  listSubsystemSideSystemLinks,
  createSideSystemLayerLink,
  deleteSideSystemLayerLink,
  listSideSystemLayerLinks,
} = await import("../../services/structure-link.service.js");
const { systemRoutes } = await import("../../routes/systems/index.js");

// ── Helpers ──────────────────────────────────────────────────────

const SYS_ID = "sys_550e8400-e29b-41d4-a716-446655440000";
const LINK_ID = "slink_550e8400-e29b-41d4-a716-446655440001";

const createApp = () => createRouteApp("/systems", systemRoutes);

const BASE_URL = `/systems/${SYS_ID}/structure-links`;

const MOCK_LINK = {
  id: LINK_ID,
  entityAId: "sub_550e8400-e29b-41d4-a716-446655440002",
  entityBId: "lyr_550e8400-e29b-41d4-a716-446655440002",
  systemId: SYS_ID as never,
  encryptedData: null,
  createdAt: 1000 as never,
};

const MOCK_PAGINATED = {
  items: [MOCK_LINK],
  nextCursor: null,
  hasMore: false,
  totalCount: null,
};

const VALID_BODY = {};

// ── Subsystem ↔ Layer ────────────────────────────────────────────

describe("POST /systems/:id/structure-links/subsystem-layer", () => {
  beforeEach(() => vi.mocked(createSubsystemLayerLink).mockReset());
  afterEach(() => vi.restoreAllMocks());

  it("returns 201 on success", async () => {
    vi.mocked(createSubsystemLayerLink).mockResolvedValueOnce(MOCK_LINK);
    const app = createApp();
    const res = await postJSON(app, `${BASE_URL}/subsystem-layer`, VALID_BODY);
    expect(res.status).toBe(201);
    const body = (await res.json()) as { id: string };
    expect(body.id).toBe(LINK_ID);
  });

  it("returns 404 when service throws NOT_FOUND", async () => {
    const { ApiHttpError } = await import("../../lib/api-error.js");
    vi.mocked(createSubsystemLayerLink).mockRejectedValueOnce(
      new ApiHttpError(404, "NOT_FOUND", "Not found"),
    );
    const app = createApp();
    const res = await postJSON(app, `${BASE_URL}/subsystem-layer`, VALID_BODY);
    expect(res.status).toBe(404);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("NOT_FOUND");
  });
});

describe("GET /systems/:id/structure-links/subsystem-layer", () => {
  beforeEach(() => vi.mocked(listSubsystemLayerLinks).mockReset());
  afterEach(() => vi.restoreAllMocks());

  it("returns 200 with paginated list", async () => {
    vi.mocked(listSubsystemLayerLinks).mockResolvedValueOnce(MOCK_PAGINATED);
    const app = createApp();
    const res = await app.request(`${BASE_URL}/subsystem-layer`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { items: unknown[] };
    expect(body.items).toHaveLength(1);
  });
});

describe("DELETE /systems/:id/structure-links/subsystem-layer/:linkId", () => {
  beforeEach(() => vi.mocked(deleteSubsystemLayerLink).mockReset());
  afterEach(() => vi.restoreAllMocks());

  it("returns 204 on success", async () => {
    vi.mocked(deleteSubsystemLayerLink).mockResolvedValueOnce(undefined);
    const app = createApp();
    const res = await app.request(`${BASE_URL}/subsystem-layer/${LINK_ID}`, {
      method: "DELETE",
    });
    expect(res.status).toBe(204);
  });
});

// ── Subsystem ↔ Side System ──────────────────────────────────────

describe("POST /systems/:id/structure-links/subsystem-side-system", () => {
  beforeEach(() => vi.mocked(createSubsystemSideSystemLink).mockReset());
  afterEach(() => vi.restoreAllMocks());

  it("returns 201 on success", async () => {
    vi.mocked(createSubsystemSideSystemLink).mockResolvedValueOnce(MOCK_LINK);
    const app = createApp();
    const res = await postJSON(app, `${BASE_URL}/subsystem-side-system`, VALID_BODY);
    expect(res.status).toBe(201);
    const body = (await res.json()) as { id: string };
    expect(body.id).toBe(LINK_ID);
  });

  it("returns 404 when service throws NOT_FOUND", async () => {
    const { ApiHttpError } = await import("../../lib/api-error.js");
    vi.mocked(createSubsystemSideSystemLink).mockRejectedValueOnce(
      new ApiHttpError(404, "NOT_FOUND", "Not found"),
    );
    const app = createApp();
    const res = await postJSON(app, `${BASE_URL}/subsystem-side-system`, VALID_BODY);
    expect(res.status).toBe(404);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("NOT_FOUND");
  });
});

describe("GET /systems/:id/structure-links/subsystem-side-system", () => {
  beforeEach(() => vi.mocked(listSubsystemSideSystemLinks).mockReset());
  afterEach(() => vi.restoreAllMocks());

  it("returns 200 with paginated list", async () => {
    vi.mocked(listSubsystemSideSystemLinks).mockResolvedValueOnce(MOCK_PAGINATED);
    const app = createApp();
    const res = await app.request(`${BASE_URL}/subsystem-side-system`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { items: unknown[] };
    expect(body.items).toHaveLength(1);
  });
});

describe("DELETE /systems/:id/structure-links/subsystem-side-system/:linkId", () => {
  beforeEach(() => vi.mocked(deleteSubsystemSideSystemLink).mockReset());
  afterEach(() => vi.restoreAllMocks());

  it("returns 204 on success", async () => {
    vi.mocked(deleteSubsystemSideSystemLink).mockResolvedValueOnce(undefined);
    const app = createApp();
    const res = await app.request(`${BASE_URL}/subsystem-side-system/${LINK_ID}`, {
      method: "DELETE",
    });
    expect(res.status).toBe(204);
  });
});

// ── Side System ↔ Layer ──────────────────────────────────────────

describe("POST /systems/:id/structure-links/side-system-layer", () => {
  beforeEach(() => vi.mocked(createSideSystemLayerLink).mockReset());
  afterEach(() => vi.restoreAllMocks());

  it("returns 201 on success", async () => {
    vi.mocked(createSideSystemLayerLink).mockResolvedValueOnce(MOCK_LINK);
    const app = createApp();
    const res = await postJSON(app, `${BASE_URL}/side-system-layer`, VALID_BODY);
    expect(res.status).toBe(201);
    const body = (await res.json()) as { id: string };
    expect(body.id).toBe(LINK_ID);
  });

  it("returns 404 when service throws NOT_FOUND", async () => {
    const { ApiHttpError } = await import("../../lib/api-error.js");
    vi.mocked(createSideSystemLayerLink).mockRejectedValueOnce(
      new ApiHttpError(404, "NOT_FOUND", "Not found"),
    );
    const app = createApp();
    const res = await postJSON(app, `${BASE_URL}/side-system-layer`, VALID_BODY);
    expect(res.status).toBe(404);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("NOT_FOUND");
  });
});

describe("GET /systems/:id/structure-links/side-system-layer", () => {
  beforeEach(() => vi.mocked(listSideSystemLayerLinks).mockReset());
  afterEach(() => vi.restoreAllMocks());

  it("returns 200 with paginated list", async () => {
    vi.mocked(listSideSystemLayerLinks).mockResolvedValueOnce(MOCK_PAGINATED);
    const app = createApp();
    const res = await app.request(`${BASE_URL}/side-system-layer`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { items: unknown[] };
    expect(body.items).toHaveLength(1);
  });
});

describe("DELETE /systems/:id/structure-links/side-system-layer/:linkId", () => {
  beforeEach(() => vi.mocked(deleteSideSystemLayerLink).mockReset());
  afterEach(() => vi.restoreAllMocks());

  it("returns 204 on success", async () => {
    vi.mocked(deleteSideSystemLayerLink).mockResolvedValueOnce(undefined);
    const app = createApp();
    const res = await app.request(`${BASE_URL}/side-system-layer/${LINK_ID}`, {
      method: "DELETE",
    });
    expect(res.status).toBe(204);
  });
});
