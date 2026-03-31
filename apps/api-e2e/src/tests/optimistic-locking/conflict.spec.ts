import { assertErrorShape } from "../../fixtures/assertions.js";
import { expect, test } from "../../fixtures/auth.fixture.js";
import { encryptForApi, ensureCryptoReady } from "../../fixtures/crypto.fixture.js";
import {
  createGroup,
  createMember,
  createStructureEntityType,
  getSystemId,
} from "../../fixtures/entity-helpers.js";
import { HTTP_CONFLICT, HTTP_OK, parseJsonBody } from "../../fixtures/http.constants.js";

test.describe("Optimistic locking conflict detection", () => {
  test.beforeAll(async () => {
    await ensureCryptoReady();
  });

  test("member update with stale version returns 409 CONFLICT", async ({
    request,
    authHeaders,
  }) => {
    const systemId = await getSystemId(request, authHeaders);
    const member = await createMember(request, authHeaders, systemId);

    // First update succeeds
    const firstUpdate = await request.put(`/v1/systems/${systemId}/members/${member.id}`, {
      headers: authHeaders,
      data: { encryptedData: encryptForApi({ name: "Updated Once" }), version: member.version },
    });
    expect(firstUpdate.status()).toBe(HTTP_OK);

    // Second update with same (now stale) version returns 409
    const secondUpdate = await request.put(`/v1/systems/${systemId}/members/${member.id}`, {
      headers: authHeaders,
      data: { encryptedData: encryptForApi({ name: "Updated Again" }), version: member.version },
    });
    expect(secondUpdate.status()).toBe(HTTP_CONFLICT);
    await assertErrorShape(secondUpdate);
    const body = await parseJsonBody<{ error: { code: string } }>(secondUpdate);
    expect(body.error.code).toBe("VERSION_CONFLICT");
  });

  test("group update with stale version returns 409 CONFLICT", async ({ request, authHeaders }) => {
    const systemId = await getSystemId(request, authHeaders);
    const group = await createGroup(request, authHeaders, systemId);

    const firstUpdate = await request.put(`/v1/systems/${systemId}/groups/${group.id}`, {
      headers: authHeaders,
      data: { encryptedData: encryptForApi({ name: "Updated Once" }), version: group.version },
    });
    expect(firstUpdate.status()).toBe(HTTP_OK);

    const secondUpdate = await request.put(`/v1/systems/${systemId}/groups/${group.id}`, {
      headers: authHeaders,
      data: { encryptedData: encryptForApi({ name: "Updated Again" }), version: group.version },
    });
    expect(secondUpdate.status()).toBe(HTTP_CONFLICT);
    await assertErrorShape(secondUpdate);
    const body = await parseJsonBody<{ error: { code: string } }>(secondUpdate);
    expect(body.error.code).toBe("VERSION_CONFLICT");
  });

  test("structure entity type update with stale version returns 409 CONFLICT", async ({
    request,
    authHeaders,
  }) => {
    const systemId = await getSystemId(request, authHeaders);
    const entityType = await createStructureEntityType(request, authHeaders, systemId);

    const firstUpdate = await request.put(
      `/v1/systems/${systemId}/structure/entity-types/${entityType.id}`,
      {
        headers: authHeaders,
        data: {
          encryptedData: encryptForApi({ name: "Updated Once" }),
          version: entityType.version,
        },
      },
    );
    expect(firstUpdate.status()).toBe(HTTP_OK);

    const secondUpdate = await request.put(
      `/v1/systems/${systemId}/structure/entity-types/${entityType.id}`,
      {
        headers: authHeaders,
        data: {
          encryptedData: encryptForApi({ name: "Updated Again" }),
          version: entityType.version,
        },
      },
    );
    expect(secondUpdate.status()).toBe(HTTP_CONFLICT);
    await assertErrorShape(secondUpdate);
    const body = await parseJsonBody<{ error: { code: string } }>(secondUpdate);
    expect(body.error.code).toBe("VERSION_CONFLICT");
  });
});
