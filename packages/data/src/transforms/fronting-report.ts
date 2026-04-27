import { brandId, toUnixMillis } from "@pluralscape/types";
import { FrontingReportEncryptedInputSchema } from "@pluralscape/validation";

import { decodeAndDecryptT1, encryptInput } from "./decode-blob.js";

import type { KdfMasterKey } from "@pluralscape/crypto";
import type {
  FrontingReport,
  FrontingReportEncryptedInput,
  FrontingReportId,
  FrontingReportWire,
  SystemId,
} from "@pluralscape/types";

/** Shape returned by `frontingReport.list`. */
export interface FrontingReportPage {
  readonly data: readonly FrontingReportWire[];
  readonly nextCursor: string | null;
}

export function decryptFrontingReport(
  raw: FrontingReportWire,
  masterKey: KdfMasterKey,
): FrontingReport {
  const decrypted = decodeAndDecryptT1(raw.encryptedData, masterKey);
  const validated = FrontingReportEncryptedInputSchema.parse(decrypted);
  return {
    id: brandId<FrontingReportId>(raw.id),
    systemId: brandId<SystemId>(raw.systemId),
    dateRange: validated.dateRange,
    memberBreakdowns: validated.memberBreakdowns,
    chartData: validated.chartData,
    format: raw.format,
    generatedAt: toUnixMillis(raw.generatedAt),
  };
}

export function decryptFrontingReportPage(
  raw: FrontingReportPage,
  masterKey: KdfMasterKey,
): { data: FrontingReport[]; nextCursor: string | null } {
  return {
    data: raw.data.map((item) => decryptFrontingReport(item, masterKey)),
    nextCursor: raw.nextCursor,
  };
}

export function encryptFrontingReportInput(
  data: FrontingReportEncryptedInput,
  masterKey: KdfMasterKey,
): { encryptedData: string } {
  return encryptInput(data, masterKey);
}
