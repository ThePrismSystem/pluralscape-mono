import { decodeAndDecryptT1, encryptAndEncodeT1 } from "./decode-blob.js";

import type { KdfMasterKey } from "@pluralscape/crypto";
import type {
  ChartData,
  DateRange,
  FrontingReport,
  FrontingReportId,
  MemberFrontingBreakdown,
  SystemId,
  UnixMillis,
} from "@pluralscape/types";

export interface FrontingReportEncryptedFields {
  readonly dateRange: DateRange;
  readonly memberBreakdowns: readonly MemberFrontingBreakdown[];
  readonly chartData: readonly ChartData[];
}

interface RawFrontingReport {
  readonly id: FrontingReportId;
  readonly systemId: SystemId;
  readonly encryptedData: string;
  readonly format: "html" | "pdf";
  readonly generatedAt: UnixMillis;
  readonly version: number;
  readonly archived: boolean;
  readonly archivedAt: UnixMillis | null;
  readonly createdAt?: UnixMillis;
  readonly updatedAt?: UnixMillis;
}

interface RawFrontingReportList {
  readonly data: readonly RawFrontingReport[];
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
  raw: RawFrontingReport,
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
  raw: RawFrontingReportList,
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
  return { encryptedData: encryptAndEncodeT1(data, masterKey) };
}
