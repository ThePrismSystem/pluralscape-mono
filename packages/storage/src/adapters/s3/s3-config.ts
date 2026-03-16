/** Configuration for the S3-compatible blob storage adapter. */
export interface S3AdapterConfig {
  /** S3 bucket name. */
  readonly bucket: string;
  /** AWS region (e.g. "us-east-1"). */
  readonly region: string;
  /** Custom endpoint URL for S3-compatible services (MinIO, R2, B2). */
  readonly endpoint?: string;
  /** Explicit credentials. Falls back to AWS SDK default credential chain if omitted. */
  readonly credentials?: {
    readonly accessKeyId: string;
    readonly secretAccessKey: string;
  };
  /** Presigned upload URL validity in milliseconds. */
  readonly presignedUploadExpiryMs?: number;
  /** Presigned download URL validity in milliseconds. */
  readonly presignedDownloadExpiryMs?: number;
  /** Maximum allowed upload size in bytes. */
  readonly maxSizeBytes?: number;
  /** Use path-style addressing. Defaults to true when endpoint is set (MinIO, etc). */
  readonly forcePathStyle?: boolean;
}

const MINUTES_15 = 15;
const MINUTES_60 = 60;
const SECONDS_PER_MINUTE = 60;
const MS_PER_SECOND = 1_000;

/** Default presigned upload URL expiry: 15 minutes. */
export const DEFAULT_PRESIGNED_UPLOAD_EXPIRY_MS = MINUTES_15 * SECONDS_PER_MINUTE * MS_PER_SECOND;

/** Default presigned download URL expiry: 1 hour. */
export const DEFAULT_PRESIGNED_DOWNLOAD_EXPIRY_MS = MINUTES_60 * SECONDS_PER_MINUTE * MS_PER_SECOND;
