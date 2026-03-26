import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  mockAuditWriterFactory,
  mockAuthFactory,
  mockDbFactory,
  mockRateLimitFactory,
  mockSystemOwnershipFactory,
} from "../../helpers/common-route-mocks.js";
import { createRouteApp, MOCK_AUTH, postJSON, putJSON } from "../../helpers/route-test-setup.js";

import type { NoteResult } from "../../../services/note.service.js";

// ── Mocks ────────────────────────────────────────────────────────

vi.mock("../../../services/note.service.js", () => ({
  createNote: vi.fn(),
  getNote: vi.fn(),
  listNotes: vi.fn(),
  updateNote: vi.fn(),
  deleteNote: vi.fn(),
  archiveNote: vi.fn(),
  restoreNote: vi.fn(),
}));

vi.mock("../../../lib/audit-writer.js", () => mockAuditWriterFactory());
vi.mock("../../../lib/db.js", () => mockDbFactory());
vi.mock("../../../lib/system-ownership.js", () => mockSystemOwnershipFactory());
vi.mock("../../../middleware/rate-limit.js", () => mockRateLimitFactory());
vi.mock("../../../middleware/auth.js", () => mockAuthFactory());

// ── Imports after mocks ──────────────────────────────────────────

const { createNote, getNote, listNotes, updateNote, deleteNote, archiveNote, restoreNote } =
  await import("../../../services/note.service.js");
const { ApiHttpError } = await import("../../../lib/api-error.js");
const { systemRoutes } = await import("../../../routes/systems/index.js");

// ── Helpers ──────────────────────────────────────────────────────

const createApp = () => createRouteApp("/systems", systemRoutes);

const BASE = "/systems/sys_550e8400-e29b-41d4-a716-446655440000/notes";
const NOTE_ID = "note_550e8400-e29b-41d4-a716-446655440000";

const MOCK_RESULT: NoteResult = {
  id: NOTE_ID as never,
  systemId: MOCK_AUTH.systemId as never,
  authorEntityType: null,
  authorEntityId: null,
  encryptedData: "dGVzdA==",
  version: 1,
  createdAt: 1000 as never,
  updatedAt: 1000 as never,
  archived: false,
  archivedAt: null,
};

// ── Tests ────────────────────────────────────────────────────────

beforeEach(() => {
  vi.mocked(createNote).mockReset();
  vi.mocked(getNote).mockReset();
  vi.mocked(listNotes).mockReset();
  vi.mocked(updateNote).mockReset();
  vi.mocked(deleteNote).mockReset();
  vi.mocked(archiveNote).mockReset();
  vi.mocked(restoreNote).mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("POST /systems/:id/notes (create)", () => {
  it("returns 201 with new note on success", async () => {
    vi.mocked(createNote).mockResolvedValueOnce(MOCK_RESULT);

    const res = await postJSON(createApp(), BASE, {
      encryptedData: "dGVzdA==",
    });

    expect(res.status).toBe(201);
    const body = (await res.json()) as { id: string };
    expect(body.id).toBe(NOTE_ID);
  });

  it("forwards systemId, body, auth, and audit writer to service", async () => {
    vi.mocked(createNote).mockResolvedValueOnce(MOCK_RESULT);

    await postJSON(createApp(), BASE, {
      encryptedData: "dGVzdA==",
    });

    expect(vi.mocked(createNote)).toHaveBeenCalledWith(
      expect.anything(),
      "sys_550e8400-e29b-41d4-a716-446655440000",
      expect.objectContaining({ encryptedData: "dGVzdA==" }),
      MOCK_AUTH,
      expect.any(Function),
    );
  });

  it("returns 500 on unexpected error", async () => {
    vi.mocked(createNote).mockRejectedValueOnce(new Error("DB timeout"));
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    const res = await postJSON(createApp(), BASE, {
      encryptedData: "dGVzdA==",
    });

    expect(res.status).toBe(500);
  });
});

describe("GET /systems/:id/notes (list)", () => {
  it("returns 200 with paginated result", async () => {
    vi.mocked(listNotes).mockResolvedValueOnce({
      items: [MOCK_RESULT],
      nextCursor: null,
      hasMore: false,
      totalCount: null,
    });

    const res = await createApp().request(BASE);

    expect(res.status).toBe(200);
    const body = (await res.json()) as { items: unknown[] };
    expect(body.items).toHaveLength(1);
  });
});

describe("GET /systems/:id/notes/:noteId", () => {
  it("returns 200 with note", async () => {
    vi.mocked(getNote).mockResolvedValueOnce(MOCK_RESULT);

    const res = await createApp().request(`${BASE}/${NOTE_ID}`);

    expect(res.status).toBe(200);
    const body = (await res.json()) as { id: string };
    expect(body.id).toBe(NOTE_ID);
  });

  it("returns 404 when note not found", async () => {
    vi.mocked(getNote).mockRejectedValueOnce(new ApiHttpError(404, "NOT_FOUND", "Note not found"));

    const res = await createApp().request(`${BASE}/${NOTE_ID}`);

    expect(res.status).toBe(404);
  });

  it("returns 500 on unexpected error", async () => {
    vi.mocked(getNote).mockRejectedValueOnce(new Error("DB timeout"));
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    const res = await createApp().request(`${BASE}/${NOTE_ID}`);

    expect(res.status).toBe(500);
  });
});

describe("PUT /systems/:id/notes/:noteId", () => {
  it("returns 200 with updated note", async () => {
    vi.mocked(updateNote).mockResolvedValueOnce({ ...MOCK_RESULT, version: 2 });

    const res = await putJSON(createApp(), `${BASE}/${NOTE_ID}`, {
      encryptedData: "dGVzdA==",
      version: 1,
    });

    expect(res.status).toBe(200);
  });

  it("returns 409 on version conflict", async () => {
    vi.mocked(updateNote).mockRejectedValueOnce(
      new ApiHttpError(409, "CONFLICT", "Version conflict"),
    );

    const res = await putJSON(createApp(), `${BASE}/${NOTE_ID}`, {
      encryptedData: "dGVzdA==",
      version: 1,
    });

    expect(res.status).toBe(409);
  });

  it("returns 404 when note not found", async () => {
    vi.mocked(updateNote).mockRejectedValueOnce(
      new ApiHttpError(404, "NOT_FOUND", "Note not found"),
    );

    const res = await putJSON(createApp(), `${BASE}/${NOTE_ID}`, {
      encryptedData: "dGVzdA==",
      version: 1,
    });

    expect(res.status).toBe(404);
  });
});

describe("DELETE /systems/:id/notes/:noteId", () => {
  it("returns 204 on success", async () => {
    vi.mocked(deleteNote).mockResolvedValueOnce(undefined);

    const res = await createApp().request(`${BASE}/${NOTE_ID}`, { method: "DELETE" });

    expect(res.status).toBe(204);
  });

  it("returns 404 when note not found", async () => {
    vi.mocked(deleteNote).mockRejectedValueOnce(
      new ApiHttpError(404, "NOT_FOUND", "Note not found"),
    );

    const res = await createApp().request(`${BASE}/${NOTE_ID}`, { method: "DELETE" });

    expect(res.status).toBe(404);
  });
});

describe("POST /systems/:id/notes/:noteId/archive", () => {
  it("returns 204 on success", async () => {
    vi.mocked(archiveNote).mockResolvedValueOnce(undefined);

    const res = await postJSON(createApp(), `${BASE}/${NOTE_ID}/archive`, {});

    expect(res.status).toBe(204);
  });

  it("returns 409 when already archived", async () => {
    vi.mocked(archiveNote).mockRejectedValueOnce(
      new ApiHttpError(409, "ALREADY_ARCHIVED", "Note is already archived"),
    );

    const res = await postJSON(createApp(), `${BASE}/${NOTE_ID}/archive`, {});

    expect(res.status).toBe(409);
  });

  it("returns 404 when note not found", async () => {
    vi.mocked(archiveNote).mockRejectedValueOnce(
      new ApiHttpError(404, "NOT_FOUND", "Note not found"),
    );

    const res = await postJSON(createApp(), `${BASE}/${NOTE_ID}/archive`, {});

    expect(res.status).toBe(404);
  });
});

describe("POST /systems/:id/notes/:noteId/restore", () => {
  it("returns 200 with restored note", async () => {
    vi.mocked(restoreNote).mockResolvedValueOnce({
      ...MOCK_RESULT,
      version: 3,
    });

    const res = await postJSON(createApp(), `${BASE}/${NOTE_ID}/restore`, {});

    expect(res.status).toBe(200);
    const body = (await res.json()) as { version: number };
    expect(body.version).toBe(3);
  });

  it("returns 409 when not archived", async () => {
    vi.mocked(restoreNote).mockRejectedValueOnce(
      new ApiHttpError(409, "NOT_ARCHIVED", "Note is not archived"),
    );

    const res = await postJSON(createApp(), `${BASE}/${NOTE_ID}/restore`, {});

    expect(res.status).toBe(409);
  });

  it("returns 404 when note not found", async () => {
    vi.mocked(restoreNote).mockRejectedValueOnce(
      new ApiHttpError(404, "NOT_FOUND", "Note not found"),
    );

    const res = await postJSON(createApp(), `${BASE}/${NOTE_ID}/restore`, {});

    expect(res.status).toBe(404);
  });
});
