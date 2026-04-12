import { decodeAndDecryptT1, encryptInput } from "./decode-blob.js";

import type { KdfMasterKey } from "@pluralscape/crypto";
import type {
  ChartData,
  DateRange,
  FrontingReport,
  MemberFrontingBreakdown,
  UnixMillis,
} from "@pluralscape/types";

export interface FrontingReportEncryptedFields {
  readonly dateRange: DateRange;
  readonly memberBreakdowns: readonly MemberFrontingBreakdown[];
  readonly chartData: readonly ChartData[];
}

/** Compile-time check: encrypted fields must be a subset of the domain type. */
export type AssertFrontingReportFieldsSubset =
  FrontingReportEncryptedFields extends Pick<FrontingReport, keyof FrontingReportEncryptedFields>
    ? true
    : never;

// ── Wire types (derived from domain types) ──────────────────────────

/** Wire shape for a fronting report — adds wire-only fields absent from the domain type. */
export type FrontingReportRaw = Omit<FrontingReport, keyof FrontingReportEncryptedFields> & {
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

// ── Validator ─────────────────────────────────────────────────────────

function assertFrontingReportEncryptedFields(
  raw: unknown,
): asserts raw is FrontingReportEncryptedFields {
  if (raw === null || typeof raw !== "object") {
    throw new Error("Decrypted fronting report blob is not an object");
  }
  const obj = raw as Record<string, unknown>;
  if (typeof obj["dateRange"] !== "object" || obj["dateRange"] === null) {
    throw new Error("Decrypted fronting report blob missing required object field: dateRange");
  }
}

// ── Transforms ───────────────────────────────────────────────────────

export function decryptFrontingReport(
  raw: FrontingReportRaw,
  masterKey: KdfMasterKey,
): FrontingReport {
  const decrypted = decodeAndDecryptT1(raw.encryptedData, masterKey);
  assertFrontingReportEncryptedFields(decrypted);
  return {
    id: raw.id,
    systemId: raw.systemId,
    dateRange: decrypted.dateRange,
    memberBreakdowns: decrypted.memberBreakdowns,
    chartData: decrypted.chartData,
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
  data: FrontingReportEncryptedFields,
  masterKey: KdfMasterKey,
): { encryptedData: string } {
  return encryptInput(data, masterKey);
}
