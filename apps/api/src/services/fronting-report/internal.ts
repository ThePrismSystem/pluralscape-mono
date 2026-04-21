import { brandId, toUnixMillis, toUnixMillisOrNull } from "@pluralscape/types";

import { encryptedBlobToBase64 } from "../../lib/encrypted-blob.js";

import type {
  EncryptedBlob,
  FrontingReportId,
  ReportFormat,
  SystemId,
  UnixMillis,
} from "@pluralscape/types";

export interface FrontingReportResult {
  readonly id: FrontingReportId;
  readonly systemId: SystemId;
  readonly encryptedData: string;
  readonly format: ReportFormat;
  readonly generatedAt: UnixMillis;
  readonly version: number;
  readonly archived: boolean;
  readonly archivedAt: UnixMillis | null;
  readonly createdAt: UnixMillis;
  readonly updatedAt: UnixMillis;
}

export function toFrontingReportResult(row: {
  id: string;
  systemId: string;
  encryptedData: EncryptedBlob;
  format: string;
  generatedAt: number;
  version: number;
  archived: boolean;
  archivedAt: number | null;
  createdAt: number;
  updatedAt: number;
}): FrontingReportResult {
  return {
    id: brandId<FrontingReportId>(row.id),
    systemId: brandId<SystemId>(row.systemId),
    encryptedData: encryptedBlobToBase64(row.encryptedData),
    format: row.format as ReportFormat,
    generatedAt: toUnixMillis(row.generatedAt),
    version: row.version,
    archived: row.archived,
    archivedAt: toUnixMillisOrNull(row.archivedAt),
    createdAt: toUnixMillis(row.createdAt),
    updatedAt: toUnixMillis(row.updatedAt),
  };
}
