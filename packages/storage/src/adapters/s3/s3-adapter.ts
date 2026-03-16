import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { now } from "@pluralscape/types/runtime";

import { BlobAlreadyExistsError, BlobNotFoundError, BlobTooLargeError } from "../../errors.js";

import {
  DEFAULT_PRESIGNED_DOWNLOAD_EXPIRY_MS,
  DEFAULT_PRESIGNED_UPLOAD_EXPIRY_MS,
} from "./s3-config.js";
import { mapS3Error } from "./s3-error-mapper.js";

import type { S3AdapterConfig } from "./s3-config.js";
import type {
  BlobStorageAdapter,
  BlobUploadParams,
  PresignedDownloadParams,
  PresignedUploadParams,
  PresignedUrlResult,
  StoredBlobMetadata,
} from "../../interface.js";

const CHECKSUM_META_KEY = "x-amz-meta-checksum";
const UPLOADED_AT_META_KEY = "x-amz-meta-uploadedat";
const MS_PER_SECOND = 1_000;

/**
 * S3-compatible blob storage adapter supporting presigned URLs.
 *
 * Works with AWS S3, MinIO, Cloudflare R2, and Backblaze B2.
 * Stores checksum and uploadedAt as S3 user metadata headers.
 */
export class S3BlobStorageAdapter implements BlobStorageAdapter {
  readonly supportsPresignedUrls = true as const;

  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly maxSizeBytes: number | null;
  private readonly presignedUploadExpiryMs: number;
  private readonly presignedDownloadExpiryMs: number;

  constructor(config: S3AdapterConfig) {
    this.bucket = config.bucket;
    this.maxSizeBytes = config.maxSizeBytes ?? null;
    this.presignedUploadExpiryMs =
      config.presignedUploadExpiryMs ?? DEFAULT_PRESIGNED_UPLOAD_EXPIRY_MS;
    this.presignedDownloadExpiryMs =
      config.presignedDownloadExpiryMs ?? DEFAULT_PRESIGNED_DOWNLOAD_EXPIRY_MS;

    this.client = new S3Client({
      region: config.region,
      endpoint: config.endpoint,
      credentials: config.credentials,
      forcePathStyle: config.endpoint !== undefined,
    });
  }

  async upload(params: BlobUploadParams): Promise<StoredBlobMetadata> {
    if (this.maxSizeBytes !== null && params.data.byteLength > this.maxSizeBytes) {
      throw new BlobTooLargeError(params.data.byteLength, this.maxSizeBytes);
    }

    // Check if blob already exists
    if (await this.exists(params.storageKey)) {
      throw new BlobAlreadyExistsError(params.storageKey);
    }

    const uploadedAt = now();

    try {
      await this.client.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: params.storageKey,
          Body: params.data,
          ContentType: params.mimeType ?? "application/octet-stream",
          ContentLength: params.data.byteLength,
          Metadata: {
            checksum: params.checksum,
            uploadedat: String(uploadedAt),
          },
        }),
      );
    } catch (err) {
      mapS3Error(err, params.storageKey);
    }

    return {
      storageKey: params.storageKey,
      sizeBytes: params.data.byteLength,
      mimeType: params.mimeType,
      checksum: params.checksum,
      uploadedAt,
    };
  }

  async download(storageKey: string): Promise<Uint8Array> {
    try {
      const response = await this.client.send(
        new GetObjectCommand({
          Bucket: this.bucket,
          Key: storageKey,
        }),
      );

      if (!response.Body) {
        throw new BlobNotFoundError(storageKey);
      }

      return new Uint8Array(await response.Body.transformToByteArray());
    } catch (err) {
      if (err instanceof BlobNotFoundError) throw err;
      mapS3Error(err, storageKey);
    }
  }

  async delete(storageKey: string): Promise<void> {
    try {
      await this.client.send(
        new DeleteObjectCommand({
          Bucket: this.bucket,
          Key: storageKey,
        }),
      );
    } catch (err) {
      // S3 DeleteObject is already idempotent — it doesn't error on missing keys.
      // Only re-throw unexpected errors.
      const name = err instanceof Error ? err.name : "";
      if (name !== "NoSuchKey" && name !== "NotFound") {
        mapS3Error(err, storageKey);
      }
    }
  }

  async exists(storageKey: string): Promise<boolean> {
    try {
      await this.client.send(
        new HeadObjectCommand({
          Bucket: this.bucket,
          Key: storageKey,
        }),
      );
      return true;
    } catch (err) {
      const name = err instanceof Error ? err.name : "";
      if (name === "NoSuchKey" || name === "NotFound" || name === "404") {
        return false;
      }
      mapS3Error(err, storageKey);
    }
  }

  async getMetadata(storageKey: string): Promise<StoredBlobMetadata | null> {
    try {
      const response = await this.client.send(
        new HeadObjectCommand({
          Bucket: this.bucket,
          Key: storageKey,
        }),
      );

      const checksum = response.Metadata?.[CHECKSUM_META_KEY.replace("x-amz-meta-", "")] ?? "";
      const uploadedAtStr =
        response.Metadata?.[UPLOADED_AT_META_KEY.replace("x-amz-meta-", "")] ?? "0";
      const mimeType = response.ContentType ?? null;

      return {
        storageKey,
        sizeBytes: response.ContentLength ?? 0,
        mimeType: mimeType === "application/octet-stream" ? null : mimeType,
        checksum,
        uploadedAt: Number(uploadedAtStr) as ReturnType<typeof now>,
      };
    } catch (err) {
      const name = err instanceof Error ? err.name : "";
      if (name === "NoSuchKey" || name === "NotFound" || name === "404") {
        return null;
      }
      mapS3Error(err, storageKey);
    }
  }

  async generatePresignedUploadUrl(params: PresignedUploadParams): Promise<PresignedUrlResult> {
    const expiryMs = params.expiresInMs ?? this.presignedUploadExpiryMs;
    const expiresInSeconds = Math.ceil(expiryMs / MS_PER_SECOND);

    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: params.storageKey,
      ContentType: params.mimeType ?? "application/octet-stream",
      ContentLength: params.sizeBytes,
    });

    const url = await getSignedUrl(this.client, command, { expiresIn: expiresInSeconds });

    return {
      supported: true,
      url,
      expiresAt: (now() + expiryMs) as ReturnType<typeof now>,
    };
  }

  async generatePresignedDownloadUrl(params: PresignedDownloadParams): Promise<PresignedUrlResult> {
    const expiryMs = params.expiresInMs ?? this.presignedDownloadExpiryMs;
    const expiresInSeconds = Math.ceil(expiryMs / MS_PER_SECOND);

    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: params.storageKey,
    });

    const url = await getSignedUrl(this.client, command, { expiresIn: expiresInSeconds });

    return {
      supported: true,
      url,
      expiresAt: (now() + expiryMs) as ReturnType<typeof now>,
    };
  }
}
