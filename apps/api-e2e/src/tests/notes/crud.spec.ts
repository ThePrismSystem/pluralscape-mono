import { expect, test } from "../../fixtures/auth.fixture.js";
import { decryptFromApi, encryptForApi, ensureCryptoReady } from "../../fixtures/crypto.fixture.js";
import { createMember, getSystemId } from "../../fixtures/entity-helpers.js";

interface NoteResponse {
  id: string;
  systemId: string;
  authorEntityType: "member" | "structure-entity" | null;
  authorEntityId: string | null;
  encryptedData: string;
  version: number;
  archived: boolean;
  archivedAt: number | null;
  createdAt: number;
  updatedAt: number;
}

interface NoteListResponse {
  data: NoteResponse[];
  nextCursor: string | null;
  hasMore: boolean;
  totalCount: number | null;
}

const NOTE_DATA = { title: "Test Note", content: "Hello world", backgroundColor: null };
const UPDATED_NOTE_DATA = {
  title: "Updated Note",
  content: "Updated content",
  backgroundColor: null,
};

test.describe("Notes CRUD", () => {
  test.beforeAll(async () => {
    await ensureCryptoReady();
  });

  test("note lifecycle: create, get, list, update, archive, restore, delete", async ({
    request,
    authHeaders,
  }) => {
    const systemId = await getSystemId(request, authHeaders);
    const noteUrl = `/v1/systems/${systemId}/notes`;
    let noteId: string;
    let noteVersion: number;

    await test.step("create system-wide note", async () => {
      const res = await request.post(noteUrl, {
        headers: authHeaders,
        data: {
          encryptedData: encryptForApi(NOTE_DATA),
        },
      });
      expect(res.status()).toBe(201);
      const body = (await res.json()) as NoteResponse;
      expect(body.id).toMatch(/^note_/);
      expect(body.authorEntityType).toBeNull();
      expect(body.authorEntityId).toBeNull();
      expect(body.version).toBe(1);
      expect(body.archived).toBe(false);
      noteId = body.id;
      noteVersion = body.version;
    });

    await test.step("get note and verify encryption round-trip", async () => {
      const res = await request.get(`${noteUrl}/${noteId}`, { headers: authHeaders });
      expect(res.status()).toBe(200);
      const body = (await res.json()) as NoteResponse;
      expect(body.id).toBe(noteId);
      const decrypted = decryptFromApi(body.encryptedData);
      expect(decrypted).toEqual(NOTE_DATA);
    });

    await test.step("list includes created note", async () => {
      const res = await request.get(noteUrl, { headers: authHeaders });
      expect(res.status()).toBe(200);
      const body = (await res.json()) as NoteListResponse;
      expect(body).toHaveProperty("data");
      expect(body).toHaveProperty("hasMore");
      expect(body.data.some((item) => item.id === noteId)).toBe(true);
    });

    await test.step("update note", async () => {
      const res = await request.put(`${noteUrl}/${noteId}`, {
        headers: authHeaders,
        data: {
          encryptedData: encryptForApi(UPDATED_NOTE_DATA),
          version: noteVersion,
        },
      });
      expect(res.status()).toBe(200);
      const body = (await res.json()) as NoteResponse;
      expect(body.version).toBe(noteVersion + 1);
      noteVersion = body.version;
    });

    await test.step("archive note", async () => {
      const res = await request.post(`${noteUrl}/${noteId}/archive`, { headers: authHeaders });
      expect(res.status()).toBe(204);
    });

    await test.step("archived not returned by default list", async () => {
      const res = await request.get(noteUrl, { headers: authHeaders });
      expect(res.status()).toBe(200);
      const body = (await res.json()) as NoteListResponse;
      expect(body.data.every((item) => item.id !== noteId)).toBe(true);
    });

    await test.step("archived returned with includeArchived=true", async () => {
      const res = await request.get(`${noteUrl}?includeArchived=true`, { headers: authHeaders });
      expect(res.status()).toBe(200);
      const body = (await res.json()) as NoteListResponse;
      expect(body.data.some((item) => item.id === noteId)).toBe(true);
    });

    await test.step("restore note", async () => {
      const res = await request.post(`${noteUrl}/${noteId}/restore`, { headers: authHeaders });
      expect(res.status()).toBe(200);
      const body = (await res.json()) as NoteResponse;
      expect(body.archived).toBe(false);
      noteVersion = body.version;
    });

    await test.step("delete note", async () => {
      const res = await request.delete(`${noteUrl}/${noteId}`, { headers: authHeaders });
      expect(res.status()).toBe(204);
    });

    await test.step("deleted note returns 404", async () => {
      const res = await request.get(`${noteUrl}/${noteId}`, { headers: authHeaders });
      expect(res.status()).toBe(404);
    });
  });

  test("member-authored note lifecycle", async ({ request, authHeaders }) => {
    const systemId = await getSystemId(request, authHeaders);
    const noteUrl = `/v1/systems/${systemId}/notes`;
    const member = await createMember(request, authHeaders, systemId, "Note Author");
    let noteId: string;

    await test.step("create member-authored note", async () => {
      const res = await request.post(noteUrl, {
        headers: authHeaders,
        data: {
          encryptedData: encryptForApi({
            title: "Member Note",
            content: "Written by a member",
            backgroundColor: null,
          }),
          author: { entityType: "member", entityId: member.id },
        },
      });
      expect(res.status()).toBe(201);
      const body = (await res.json()) as NoteResponse;
      expect(body.id).toMatch(/^note_/);
      expect(body.authorEntityType).toBe("member");
      expect(body.authorEntityId).toBe(member.id);
      noteId = body.id;
    });

    await test.step("list filtered by authorEntityType=member", async () => {
      const res = await request.get(`${noteUrl}?authorEntityType=member`, { headers: authHeaders });
      expect(res.status()).toBe(200);
      const body = (await res.json()) as NoteListResponse;
      expect(body.data.some((item) => item.id === noteId)).toBe(true);
      for (const item of body.data) {
        expect(item.authorEntityType).toBe("member");
      }
    });

    await test.step("list filtered by authorEntityId", async () => {
      const res = await request.get(
        `${noteUrl}?authorEntityType=member&authorEntityId=${member.id}`,
        {
          headers: authHeaders,
        },
      );
      expect(res.status()).toBe(200);
      const body = (await res.json()) as NoteListResponse;
      expect(body.data.some((item) => item.id === noteId)).toBe(true);
      for (const item of body.data) {
        expect(item.authorEntityId).toBe(member.id);
      }
    });

    await test.step("list filtered by systemWide excludes member note", async () => {
      const res = await request.get(`${noteUrl}?systemWide=true`, { headers: authHeaders });
      expect(res.status()).toBe(200);
      const body = (await res.json()) as NoteListResponse;
      expect(body.data.every((item) => item.id !== noteId)).toBe(true);
      for (const item of body.data) {
        expect(item.authorEntityType).toBeNull();
      }
    });
  });

  test("update with wrong version returns 409", async ({ request, authHeaders }) => {
    const systemId = await getSystemId(request, authHeaders);
    const noteUrl = `/v1/systems/${systemId}/notes`;

    const createRes = await request.post(noteUrl, {
      headers: authHeaders,
      data: { encryptedData: encryptForApi(NOTE_DATA) },
    });
    const note = (await createRes.json()) as NoteResponse;

    const res = await request.put(`${noteUrl}/${note.id}`, {
      headers: authHeaders,
      data: { encryptedData: encryptForApi(UPDATED_NOTE_DATA), version: 999 },
    });
    expect(res.status()).toBe(409);
  });

  test("archive already archived returns 409", async ({ request, authHeaders }) => {
    const systemId = await getSystemId(request, authHeaders);
    const noteUrl = `/v1/systems/${systemId}/notes`;

    const createRes = await request.post(noteUrl, {
      headers: authHeaders,
      data: { encryptedData: encryptForApi(NOTE_DATA) },
    });
    const note = (await createRes.json()) as NoteResponse;

    await request.post(`${noteUrl}/${note.id}/archive`, { headers: authHeaders });

    const res = await request.post(`${noteUrl}/${note.id}/archive`, { headers: authHeaders });
    expect(res.status()).toBe(409);
  });

  test("restore non-archived returns 409", async ({ request, authHeaders }) => {
    const systemId = await getSystemId(request, authHeaders);
    const noteUrl = `/v1/systems/${systemId}/notes`;

    const createRes = await request.post(noteUrl, {
      headers: authHeaders,
      data: { encryptedData: encryptForApi(NOTE_DATA) },
    });
    const note = (await createRes.json()) as NoteResponse;

    const res = await request.post(`${noteUrl}/${note.id}/restore`, { headers: authHeaders });
    expect(res.status()).toBe(409);
  });

  test("get non-existent note returns 404", async ({ request, authHeaders }) => {
    const systemId = await getSystemId(request, authHeaders);
    const noteUrl = `/v1/systems/${systemId}/notes`;

    const res = await request.get(`${noteUrl}/note_00000000-0000-0000-0000-000000000000`, {
      headers: authHeaders,
    });
    expect(res.status()).toBe(404);
  });

  test("delete non-existent note returns 404", async ({ request, authHeaders }) => {
    const systemId = await getSystemId(request, authHeaders);
    const noteUrl = `/v1/systems/${systemId}/notes`;

    const res = await request.delete(`${noteUrl}/note_00000000-0000-0000-0000-000000000000`, {
      headers: authHeaders,
    });
    expect(res.status()).toBe(404);
  });
});
