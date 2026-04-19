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
interface UploadUrlResponse {
  blobId: string;
  uploadUrl: string;
  expiresAt: string;
  fields?: Record<string, string>;
}

async function requestUploadUrl(
  request: APIRequestContext,
  authHeaders: Record<string, string>,
  systemId: string,
  options?: { sizeBytes?: number },
): Promise<UploadUrlResponse> {
  const res = await request.post(`/v1/systems/${systemId}/blobs/upload-url`, {
    headers: authHeaders,
    data: {
      purpose: "avatar",
      mimeType: "image/png",
      sizeBytes: options?.sizeBytes ?? BLOB_SIZE_BYTES,
      encryptionTier: 1,
    },
  });
  expect(res.status()).toBe(201);
  const json = (await res.json()) as { data: UploadUrlResponse };
  expect(json.data).toHaveProperty("blobId");
  expect(json.data).toHaveProperty("uploadUrl");
  expect(json.data).toHaveProperty("expiresAt");
  return json.data;
}

/**
 * Upload a blob to a presigned PUT URL.
 *
 * The S3 adapter signs `If-None-Match: *` into the URL (write-once
 * enforcement), so the client must forward that header for the signature
 * to validate. Uses native fetch to bypass Playwright's default headers.
 */
async function putToPresignedUrl(uploadUrl: string): Promise<void> {
  const body = Buffer.alloc(BLOB_SIZE_BYTES, 0x42);
  const res = await fetch(uploadUrl, {
    method: "PUT",
    body,
    headers: {
      "Content-Type": "image/png",
      "If-None-Match": "*",
    },
  });
  expect(res.ok).toBe(true);
}

/**
 * Upload file content to the presigned URL and confirm the upload.
 */
async function uploadAndConfirmBlob(
  request: APIRequestContext,
  authHeaders: Record<string, string>,
  systemId: string,
  upload: UploadUrlResponse,
): Promise<void> {
  await putToPresignedUrl(upload.uploadUrl);

  const confirmRes = await request.post(`/v1/systems/${systemId}/blobs/${upload.blobId}/confirm`, {
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

    await test.step("get upload url and upload file", async () => {
      const upload = await requestUploadUrl(request, authHeaders, systemId);
      blobId = upload.blobId;
      await putToPresignedUrl(upload.uploadUrl);
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
      const getBody = (await getRes.json()) as {
        data: {
          id: string;
          systemId: string;
          purpose: string;
          mimeType: string;
          sizeBytes: number;
          checksum: string;
          uploadedAt: string;
          thumbnailOfBlobId: string | null;
        };
      };
      expect(getBody.data.id).toBe(blobId);
      expect(getBody.data.systemId).toBe(systemId);
      expect(getBody.data.purpose).toBe("avatar");
      expect(getBody.data.mimeType).toBe("image/png");
    });

    await test.step("get download url", async () => {
      const downloadRes = await request.get(`${blobsUrl}/${blobId}/download-url`, {
        headers: authHeaders,
      });
      expect(downloadRes.status()).toBe(200);
      const body = (await downloadRes.json()) as { data: { blobId: string; downloadUrl: string } };
      expect(body.data.blobId).toBe(blobId);
      expect(typeof body.data.downloadUrl).toBe("string");
    });

    await test.step("delete blob", async () => {
      const deleteRes = await request.delete(`${blobsUrl}/${blobId}`, {
        headers: authHeaders,
      });
      expect(deleteRes.status()).toBe(204);

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
    await uploadAndConfirmBlob(request, authHeaders, systemId, first);

    const second = await requestUploadUrl(request, authHeaders, systemId);
    await uploadAndConfirmBlob(request, authHeaders, systemId, second);

    const listRes = await request.get(blobsUrl, { headers: authHeaders });
    expect(listRes.status()).toBe(200);
    const body = (await listRes.json()) as {
      data: Array<{ id: string }>;
      nextCursor: string | null;
      hasMore: boolean;
    };
    expect(body.data.length).toBeGreaterThanOrEqual(2);
    expect(body).toHaveProperty("nextCursor");
    expect(body).toHaveProperty("hasMore");
  });

  test("cross-system access returns 404", async ({ request, authHeaders }) => {
    const res = await request.get(`/v1/systems/${FAKE_SYSTEM_ID}/blobs`, {
      headers: authHeaders,
    });
    expect(res.status()).toBe(404);
  });

  /**
   * Negative test: the presigned PUT signs the exact Content-Length that
   * `requestUploadUrl` sent in `sizeBytes`. Sending a larger body must be
   * rejected by S3 signature enforcement — otherwise a client could upload
   * arbitrarily large blobs past the server-side quota.
   */
  test("oversized PUT body rejected by S3 signature", async ({ request, authHeaders }) => {
    const systemId = await getSystemId(request, authHeaders);
    const upload = await requestUploadUrl(request, authHeaders, systemId);

    const oversize = Buffer.alloc(BLOB_SIZE_BYTES + 1024, 0x42);
    const res = await fetch(upload.uploadUrl, {
      method: "PUT",
      body: oversize,
      headers: {
        "Content-Type": "image/png",
        "Content-Length": String(oversize.length),
        "If-None-Match": "*",
      },
    });
    expect(res.ok).toBe(false);
    // S3/MinIO return 400 (BadRequest) or 403 (SignatureDoesNotMatch) for
    // Content-Length mismatches. Either is an acceptable rejection.
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
  });

  /**
   * Locks in the SigV4 exact-size contract documented on
   * `PresignedUploadParams.sizeBytes`: declare N bytes when requesting the
   * upload URL, then PUT N+1 bytes. The Content-Length constraint baked
   * into the signature must reject this with 403 SignatureDoesNotMatch.
   */
  test("presigned PUT rejects exact Content-Length mismatch with 403", async ({
    request,
    authHeaders,
  }) => {
    const systemId = await getSystemId(request, authHeaders);
    const declaredSize = 16;
    const upload = await requestUploadUrl(request, authHeaders, systemId, {
      sizeBytes: declaredSize,
    });

    // Body is exactly one byte longer than declared so the SigV4
    // Content-Length constraint rejects it at the S3 layer.
    const mismatchedBody = Buffer.alloc(declaredSize + 1, 0x61);

    const putResponse = await fetch(upload.uploadUrl, {
      method: "PUT",
      body: mismatchedBody,
      headers: {
        "Content-Type": "image/png",
        "Content-Length": String(mismatchedBody.length),
        "If-None-Match": "*",
      },
    });

    expect(putResponse.status).toBe(403);
    const body = await putResponse.text();
    expect(body).toContain("SignatureDoesNotMatch");
  });

  /**
   * Negative test: the presigned PUT signs `Content-Type: image/png` into
   * the URL. Sending a mismatched Content-Type must fail signature
   * verification — prevents a client from uploading an arbitrary MIME
   * type under cover of a URL requested for `image/png`.
   */
  test("PUT with mismatched Content-Type rejected by S3 signature", async ({
    request,
    authHeaders,
  }) => {
    const systemId = await getSystemId(request, authHeaders);
    const upload = await requestUploadUrl(request, authHeaders, systemId);

    const body = Buffer.alloc(BLOB_SIZE_BYTES, 0x42);
    const res = await fetch(upload.uploadUrl, {
      method: "PUT",
      body,
      headers: {
        // URL was signed for image/png; application/pdf breaks the signature.
        "Content-Type": "application/pdf",
        "If-None-Match": "*",
      },
    });
    expect(res.ok).toBe(false);
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
  });
});
