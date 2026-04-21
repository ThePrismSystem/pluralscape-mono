import { brandId, toChecksumHex, toUnixMillis } from "@pluralscape/types";

import type {
  BlobId,
  BlobPurpose,
  ChecksumHex,
  SystemId,
  UnixMillis,
} from "@pluralscape/types";

export interface BlobResult {
  readonly id: BlobId;
  readonly systemId: SystemId;
  readonly purpose: BlobPurpose;
  readonly mimeType: string | null;
  readonly sizeBytes: number;
  readonly checksum: ChecksumHex | null;
  readonly uploadedAt: UnixMillis;
  readonly thumbnailOfBlobId: BlobId | null;
}

export function toBlobResult(row: {
  id: string;
  systemId: string;
  purpose: string;
  mimeType: string | null;
  sizeBytes: number;
  checksum: string | null;
  uploadedAt: number | null;
  thumbnailOfBlobId: string | null;
}): BlobResult {
  return {
    id: brandId<BlobId>(row.id),
    systemId: brandId<SystemId>(row.systemId),
    purpose: row.purpose as BlobPurpose,
    mimeType: row.mimeType,
    sizeBytes: row.sizeBytes,
    checksum: row.checksum ? toChecksumHex(row.checksum) : null,
    uploadedAt: toUnixMillis(row.uploadedAt ?? 0),
    thumbnailOfBlobId: row.thumbnailOfBlobId ? brandId<BlobId>(row.thumbnailOfBlobId) : null,
  };
}
