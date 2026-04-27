import { FrontingReportEncryptedInputSchema } from "@pluralscape/validation";

import { decodeAndDecryptT1, encryptInput } from "./decode-blob.js";

import type { KdfMasterKey } from "@pluralscape/crypto";
import type { FrontingReport, FrontingReportEncryptedInput, UnixMillis } from "@pluralscape/types";

// ── Wire types (derived from domain types) ──────────────────────────

/** Wire shape for a fronting report — adds wire-only fields absent from the domain type. */
export type FrontingReportRaw = Omit<FrontingReport, keyof FrontingReportEncryptedInput> & {
  readonly encryptedData: string;
  readonly version: number;
  readonly archived: boolean;
  readonly archivedAt: UnixMillis | null;
  readonly createdAt?: UnixMillis;
  readonly updatedAt?: UnixMillis;
};

/** Shape returned by `frontingReport.list`. */
export interface FrontingReportPage {
  readonly data: readonly FrontingReportRaw[];
  readonly nextCursor: string | null;
}

// ── Transforms ───────────────────────────────────────────────────────

export function decryptFrontingReport(
  raw: FrontingReportRaw,
  masterKey: KdfMasterKey,
): FrontingReport {
  const decrypted = decodeAndDecryptT1(raw.encryptedData, masterKey);
  const validated = FrontingReportEncryptedInputSchema.parse(decrypted);
  return {
    id: raw.id,
    systemId: raw.systemId,
    dateRange: validated.dateRange,
    memberBreakdowns: validated.memberBreakdowns,
    chartData: validated.chartData,
    format: raw.format,
    generatedAt: raw.generatedAt,
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
