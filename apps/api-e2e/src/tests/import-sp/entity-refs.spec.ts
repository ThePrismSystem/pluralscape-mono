/**
 * Import entity ref batch endpoints — lookup-batch and upsert-batch.
 *
 * Exercises the Phase A server procedures end-to-end: idempotent upsert,
 * batch lookup, pluralscape-entity-id overwrite on conflict, and RLS
 * isolation between accounts.
 */
import { expect, test } from "../../fixtures/auth.fixture.js";
import { ensureCryptoReady } from "../../fixtures/crypto.fixture.js";
import { getSystemId } from "../../fixtures/entity-helpers.js";
import { HTTP_OK, parseJsonBody } from "../../fixtures/http.constants.js";

const REF_BATCH_SIZE = 5;

interface UpsertBatchEnvelope {
  data: {
    upserted: number;
    unchanged: number;
  };
}

interface LookupBatchEnvelope {
  data: Record<string, string>;
}

/**
 * Deterministic mapping from a batch index to a pluralscape-shaped member ID.
 * Using the `mbr_` prefix keeps the shape realistic even though no real
 * member rows exist — `import_entity_refs` stores the string without
 * referential integrity.
 */
function memberId(uuid: string, index: number): string {
  const indexStr = String(index).padStart(12, "0");
  return `mbr_${uuid.slice(0, 8)}-${uuid.slice(9, 13)}-${uuid.slice(14, 18)}-${uuid.slice(19, 23)}-${indexStr}`;
}

function sourceId(uuid: string, index: number): string {
  return `sp-member-${uuid.slice(0, 8)}-${String(index)}`;
}

test.describe("Import entity ref batch endpoints", () => {
  test.beforeAll(async () => {
    await ensureCryptoReady();
  });

  test("upsert, lookup, idempotency, conflict update, and rls isolation", async ({
    request,
    authHeaders,
    secondAuthHeaders,
  }) => {
    const systemA = await getSystemId(request, authHeaders);
    const systemB = await getSystemId(request, secondAuthHeaders);
    const testUuid = crypto.randomUUID();

    const lookupUrlA = `/v1/systems/${systemA}/import-entity-refs/lookup-batch`;
    const upsertUrlA = `/v1/systems/${systemA}/import-entity-refs/upsert-batch`;
    const lookupUrlB = `/v1/systems/${systemB}/import-entity-refs/lookup-batch`;

    const sourceIds: string[] = [];
    const pluralscapeIds: string[] = [];
    for (let i = 0; i < REF_BATCH_SIZE; i += 1) {
      sourceIds.push(sourceId(testUuid, i));
      pluralscapeIds.push(memberId(testUuid, i));
    }
    const initialEntries = sourceIds.map((sid, idx) => ({
      sourceEntityType: "member" as const,
      sourceEntityId: sid,
      pluralscapeEntityId: pluralscapeIds[idx] ?? "",
    }));

    await test.step("upsert batch of 5 refs as account A", async () => {
      const res = await request.post(upsertUrlA, {
        headers: authHeaders,
        data: { source: "simply-plural", entries: initialEntries },
      });
      expect(res.status()).toBe(HTTP_OK);
      const body = await parseJsonBody<UpsertBatchEnvelope>(res);
      expect(body.data.upserted).toBe(REF_BATCH_SIZE);
      expect(body.data.unchanged).toBe(0);
    });

    await test.step("lookup batch returns all 5", async () => {
      const res = await request.post(lookupUrlA, {
        headers: authHeaders,
        data: {
          source: "simply-plural",
          sourceEntityType: "member",
          sourceEntityIds: sourceIds,
        },
      });
      expect(res.status()).toBe(HTTP_OK);
      const body = await parseJsonBody<LookupBatchEnvelope>(res);
      expect(Object.keys(body.data)).toHaveLength(REF_BATCH_SIZE);
      for (let i = 0; i < REF_BATCH_SIZE; i += 1) {
        const sid = sourceIds[i] ?? "";
        expect(body.data[sid]).toBe(pluralscapeIds[i]);
      }
    });

    await test.step("idempotent re-upsert reports all unchanged", async () => {
      const res = await request.post(upsertUrlA, {
        headers: authHeaders,
        data: { source: "simply-plural", entries: initialEntries },
      });
      expect(res.status()).toBe(HTTP_OK);
      const body = await parseJsonBody<UpsertBatchEnvelope>(res);
      expect(body.data.upserted).toBe(0);
      expect(body.data.unchanged).toBe(REF_BATCH_SIZE);

      // Follow-up lookup should still return all 5 with unchanged values.
      const lookupRes = await request.post(lookupUrlA, {
        headers: authHeaders,
        data: {
          source: "simply-plural",
          sourceEntityType: "member",
          sourceEntityIds: sourceIds,
        },
      });
      expect(lookupRes.status()).toBe(HTTP_OK);
      const lookupBody = await parseJsonBody<LookupBatchEnvelope>(lookupRes);
      expect(Object.keys(lookupBody.data)).toHaveLength(REF_BATCH_SIZE);
      for (let i = 0; i < REF_BATCH_SIZE; i += 1) {
        const sid = sourceIds[i] ?? "";
        expect(lookupBody.data[sid]).toBe(pluralscapeIds[i]);
      }
    });

    await test.step("upsert updates pluralscapeEntityId on conflict", async () => {
      const conflictSourceId = sourceIds[0] ?? "";
      const newPluralscapeId = memberId(testUuid, REF_BATCH_SIZE);
      const res = await request.post(upsertUrlA, {
        headers: authHeaders,
        data: {
          source: "simply-plural",
          entries: [
            {
              sourceEntityType: "member",
              sourceEntityId: conflictSourceId,
              pluralscapeEntityId: newPluralscapeId,
            },
          ],
        },
      });
      expect(res.status()).toBe(HTTP_OK);
      const body = await parseJsonBody<UpsertBatchEnvelope>(res);
      expect(body.data.upserted).toBe(1);
      expect(body.data.unchanged).toBe(0);

      const lookupRes = await request.post(lookupUrlA, {
        headers: authHeaders,
        data: {
          source: "simply-plural",
          sourceEntityType: "member",
          sourceEntityIds: [conflictSourceId],
        },
      });
      expect(lookupRes.status()).toBe(HTTP_OK);
      const lookupBody = await parseJsonBody<LookupBatchEnvelope>(lookupRes);
      expect(lookupBody.data[conflictSourceId]).toBe(newPluralscapeId);
    });

    await test.step("rls: second account sees no refs for account a source ids", async () => {
      const res = await request.post(lookupUrlB, {
        headers: secondAuthHeaders,
        data: {
          source: "simply-plural",
          sourceEntityType: "member",
          sourceEntityIds: sourceIds,
        },
      });
      expect(res.status()).toBe(HTTP_OK);
      const body = await parseJsonBody<LookupBatchEnvelope>(res);
      expect(Object.keys(body.data)).toHaveLength(0);
    });
  });
});
