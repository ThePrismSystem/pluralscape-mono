import { expect, test } from "../../fixtures/auth.fixture.js";
import { ensureCryptoReady } from "../../fixtures/crypto.fixture.js";
import { getSystemId } from "../../fixtures/entity-helpers.js";

import type { APIRequestContext } from "@playwright/test";

/** Dummy 64-character hex checksum for upload confirmation. */
const DUMMY_CHECKSUM = "a".repeat(64);

/** Size in bytes for the test blob payload. */
const BLOB_SIZE_BYTES = 1024;

/** Fake system ID guaranteed to not belong to the authenticated user. */
const FAKE_SYSTEM_ID = "sys_00000000-0000-0000-0000-000000000000";

/**
 * Request a presigned upload URL and return the blob ID and upload URL.
 */
async function requestUploadUrl(
  request: APIRequestContext,
  authHeaders: Record<string, string>,
  systemId: string,
): Promise<{ blobId: string; uploadUrl: string; expiresAt: string }> {
  const res = await request.post(`/v1/systems/${systemId}/blobs/upload-url`, {
    headers: authHeaders,
    data: {
      purpose: "avatar",
      mimeType: "image/png",
      sizeBytes: BLOB_SIZE_BYTES,
      encryptionTier: 1,
    },
  });
  expect(res.status()).toBe(201);
  const body = (await res.json()) as { blobId: string; uploadUrl: string; expiresAt: string };
  expect(body).toHaveProperty("blobId");
  expect(body).toHaveProperty("uploadUrl");
  expect(body).toHaveProperty("expiresAt");
  return body;
}

/**
 * Upload file content to the presigned URL and confirm the upload.
 */
async function uploadAndConfirmBlob(
  request: APIRequestContext,
  authHeaders: Record<string, string>,
  systemId: string,
  blobId: string,
  uploadUrl: string,
): Promise<void> {
  const uploadRes = await request.put(uploadUrl, {
    data: Buffer.alloc(BLOB_SIZE_BYTES, 0x42),
    headers: { "Content-Type": "image/png" },
  });
  expect(uploadRes.ok()).toBe(true);

  const confirmRes = await request.post(`/v1/systems/${systemId}/blobs/${blobId}/confirm`, {
    headers: authHeaders,
    data: { checksum: DUMMY_CHECKSUM },
  });
  expect(confirmRes.status()).toBe(200);
}

test.describe("Blobs CRUD", () => {
  test.beforeAll(async () => {
    await ensureCryptoReady();
  });

  test("blob upload lifecycle: get upload url, upload file, confirm, get metadata, download url, delete", async ({
    request,
    authHeaders,
  }) => {
    const systemId = await getSystemId(request, authHeaders);
    const blobsUrl = `/v1/systems/${systemId}/blobs`;
    let blobId: string;

    await test.step("get upload url", async () => {
      const body = await requestUploadUrl(request, authHeaders, systemId);
      blobId = body.blobId;

      await test.step("upload file to presigned URL", async () => {
        const uploadRes = await request.put(body.uploadUrl, {
          data: Buffer.alloc(BLOB_SIZE_BYTES, 0x42),
          headers: { "Content-Type": "image/png" },
        });
        expect(uploadRes.ok()).toBe(true);
      });
    });

    await test.step("confirm upload", async () => {
      const confirmRes = await request.post(`${blobsUrl}/${blobId}/confirm`, {
        headers: authHeaders,
        data: { checksum: DUMMY_CHECKSUM },
      });
      expect(confirmRes.status()).toBe(200);
    });

    await test.step("get blob metadata", async () => {
      const getRes = await request.get(`${blobsUrl}/${blobId}`, {
        headers: authHeaders,
      });
      expect(getRes.status()).toBe(200);
      const metadata = (await getRes.json()) as {
        id: string;
        systemId: string;
        purpose: string;
        mimeType: string;
        sizeBytes: number;
        checksum: string;
        uploadedAt: string;
        thumbnailOfBlobId: string | null;
      };
      expect(metadata.id).toBe(blobId);
      expect(metadata.systemId).toBe(systemId);
      expect(metadata.purpose).toBe("avatar");
      expect(metadata.mimeType).toBe("image/png");
    });

    await test.step("get download url", async () => {
      const downloadRes = await request.get(`${blobsUrl}/${blobId}/download-url`, {
        headers: authHeaders,
      });
      expect(downloadRes.status()).toBe(200);
      const body = (await downloadRes.json()) as { blobId: string; downloadUrl: string };
      expect(body.blobId).toBe(blobId);
      expect(typeof body.downloadUrl).toBe("string");
    });

    await test.step("delete blob", async () => {
      const deleteRes = await request.delete(`${blobsUrl}/${blobId}`, {
        headers: authHeaders,
      });
      expect(deleteRes.status()).toBe(200);

      const getAfterDelete = await request.get(`${blobsUrl}/${blobId}`, {
        headers: authHeaders,
      });
      expect(getAfterDelete.status()).toBe(404);
    });
  });

  test("list blobs", async ({ request, authHeaders }) => {
    const systemId = await getSystemId(request, authHeaders);
    const blobsUrl = `/v1/systems/${systemId}/blobs`;

    const first = await requestUploadUrl(request, authHeaders, systemId);
    await uploadAndConfirmBlob(request, authHeaders, systemId, first.blobId, first.uploadUrl);

    const second = await requestUploadUrl(request, authHeaders, systemId);
    await uploadAndConfirmBlob(request, authHeaders, systemId, second.blobId, second.uploadUrl);

    const listRes = await request.get(blobsUrl, { headers: authHeaders });
    expect(listRes.status()).toBe(200);
    const body = (await listRes.json()) as {
      items: Array<{ id: string }>;
      cursor: string | null;
      hasMore: boolean;
    };
    expect(body.items.length).toBeGreaterThanOrEqual(2);
    expect(body).toHaveProperty("cursor");
    expect(body).toHaveProperty("hasMore");
  });

  test("cross-system access returns 404", async ({ request, authHeaders }) => {
    const res = await request.get(`/v1/systems/${FAKE_SYSTEM_ID}/blobs`, {
      headers: authHeaders,
    });
    expect(res.status()).toBe(404);
  });
});
