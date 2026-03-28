import { assertType, describe, expect, expectTypeOf, it } from "vitest";

import { isReportType, REPORT_TYPES } from "../reports.js";

import type { BucketId, SystemId } from "../ids.js";
import type { PaginationCursor } from "../pagination.js";
import type { BucketContentEntityType } from "../privacy.js";
import type {
  BucketExportEntity,
  BucketExportManifestEntry,
  BucketExportManifestResponse,
  BucketExportPageResponse,
  ExportEntityId,
  MeetOurSystemReportConfig,
  MeetOurSystemReportData,
  MemberByBucketReportConfig,
  MemberByBucketReportData,
  ReportConfig,
  ReportData,
  ReportEntitySet,
  ReportType,
} from "../reports.js";
import type { UnixMillis } from "../timestamps.js";

// ── ReportType ────────────────────────────────────────────────────

describe("ReportType", () => {
  it("accepts valid report types", () => {
    assertType<ReportType>("member-by-bucket");
    assertType<ReportType>("meet-our-system");
  });

  it("rejects invalid strings", () => {
    // @ts-expect-error invalid report type
    assertType<ReportType>("invalid");
  });

  it("is exhaustive in a switch", () => {
    function handleReportType(type: ReportType): string {
      switch (type) {
        case "member-by-bucket":
        case "meet-our-system":
          return type;
        default: {
          const _exhaustive: never = type;
          return _exhaustive;
        }
      }
    }
    expectTypeOf(handleReportType).toBeFunction();
  });
});

// ── REPORT_TYPES ──────────────────────────────────────────────────

describe("REPORT_TYPES", () => {
  it("has length 2", () => {
    expect(REPORT_TYPES).toHaveLength(2);
  });

  it("contains both report types", () => {
    expect(REPORT_TYPES).toContain("member-by-bucket");
    expect(REPORT_TYPES).toContain("meet-our-system");
  });
});

// ── isReportType ──────────────────────────────────────────────────

describe("isReportType", () => {
  it("returns true for valid report types", () => {
    expect(isReportType("member-by-bucket")).toBe(true);
    expect(isReportType("meet-our-system")).toBe(true);
  });

  it("returns false for invalid strings", () => {
    expect(isReportType("invalid")).toBe(false);
    expect(isReportType("")).toBe(false);
    expect(isReportType("member")).toBe(false);
  });
});

// ── ReportConfig ──────────────────────────────────────────────────

describe("MemberByBucketReportConfig", () => {
  it("has correct field types", () => {
    expectTypeOf<MemberByBucketReportConfig["reportType"]>().toEqualTypeOf<"member-by-bucket">();
    expectTypeOf<MemberByBucketReportConfig["bucketId"]>().toEqualTypeOf<BucketId>();
  });

  it("has optional title and locale", () => {
    expectTypeOf<MemberByBucketReportConfig["title"]>().toEqualTypeOf<string | undefined>();
    expectTypeOf<MemberByBucketReportConfig["locale"]>().toEqualTypeOf<string | undefined>();
  });
});

describe("MeetOurSystemReportConfig", () => {
  it("has correct field types", () => {
    expectTypeOf<MeetOurSystemReportConfig["reportType"]>().toEqualTypeOf<"meet-our-system">();
  });

  it("has optional title and locale", () => {
    expectTypeOf<MeetOurSystemReportConfig["title"]>().toEqualTypeOf<string | undefined>();
    expectTypeOf<MeetOurSystemReportConfig["locale"]>().toEqualTypeOf<string | undefined>();
  });

  it("does not have bucketId", () => {
    expectTypeOf<MeetOurSystemReportConfig>().not.toHaveProperty("bucketId");
  });
});

describe("ReportConfig", () => {
  it("narrows correctly on reportType discriminant", () => {
    function handleConfig(config: ReportConfig): string {
      switch (config.reportType) {
        case "member-by-bucket":
          // Should narrow to MemberByBucketReportConfig
          expectTypeOf(config).toEqualTypeOf<MemberByBucketReportConfig>();
          return config.bucketId;
        case "meet-our-system":
          // Should narrow to MeetOurSystemReportConfig
          expectTypeOf(config).toEqualTypeOf<MeetOurSystemReportConfig>();
          return config.reportType;
        default: {
          const _exhaustive: never = config;
          return _exhaustive;
        }
      }
    }
    expectTypeOf(handleConfig).toBeFunction();
  });
});

// ── ReportData ────────────────────────────────────────────────────

describe("ReportEntitySet", () => {
  it("is keyed by BucketContentEntityType with unknown array values", () => {
    expectTypeOf<ReportEntitySet["member"]>().toEqualTypeOf<readonly Record<string, unknown>[]>();
    expectTypeOf<ReportEntitySet["group"]>().toEqualTypeOf<readonly Record<string, unknown>[]>();
    expectTypeOf<ReportEntitySet["fronting-session"]>().toEqualTypeOf<
      readonly Record<string, unknown>[]
    >();
  });

  it("uses BucketContentEntityType as keys", () => {
    expectTypeOf<keyof ReportEntitySet>().toEqualTypeOf<BucketContentEntityType>();
  });

  it("accepts a generic type parameter for record shape", () => {
    interface MyRecord extends Record<string, unknown> {
      readonly name: string;
    }
    type Typed = ReportEntitySet<MyRecord>;
    expectTypeOf<Typed["member"]>().toEqualTypeOf<readonly MyRecord[]>();
  });
});

describe("MemberByBucketReportData", () => {
  it("has correct field types", () => {
    expectTypeOf<MemberByBucketReportData["reportType"]>().toEqualTypeOf<"member-by-bucket">();
    expectTypeOf<MemberByBucketReportData["systemId"]>().toEqualTypeOf<SystemId>();
    expectTypeOf<MemberByBucketReportData["bucketId"]>().toEqualTypeOf<BucketId>();
    expectTypeOf<MemberByBucketReportData["generatedAt"]>().toEqualTypeOf<UnixMillis>();
    expectTypeOf<MemberByBucketReportData["title"]>().toEqualTypeOf<string | null>();
    expectTypeOf<MemberByBucketReportData["entities"]>().toEqualTypeOf<ReportEntitySet>();
  });
});

describe("MeetOurSystemReportData", () => {
  it("has correct field types", () => {
    expectTypeOf<MeetOurSystemReportData["reportType"]>().toEqualTypeOf<"meet-our-system">();
    expectTypeOf<MeetOurSystemReportData["systemId"]>().toEqualTypeOf<SystemId>();
    expectTypeOf<MeetOurSystemReportData["generatedAt"]>().toEqualTypeOf<UnixMillis>();
    expectTypeOf<MeetOurSystemReportData["title"]>().toEqualTypeOf<string | null>();
    expectTypeOf<MeetOurSystemReportData["entities"]>().toEqualTypeOf<ReportEntitySet>();
  });

  it("does not have bucketId", () => {
    expectTypeOf<MeetOurSystemReportData>().not.toHaveProperty("bucketId");
  });
});

describe("ReportData", () => {
  it("narrows correctly on reportType discriminant", () => {
    function handleData(data: ReportData): string {
      switch (data.reportType) {
        case "member-by-bucket":
          expectTypeOf(data).toEqualTypeOf<MemberByBucketReportData>();
          return data.bucketId;
        case "meet-our-system":
          expectTypeOf(data).toEqualTypeOf<MeetOurSystemReportData>();
          return data.reportType;
        default: {
          const _exhaustive: never = data;
          return _exhaustive;
        }
      }
    }
    expectTypeOf(handleData).toBeFunction();
  });
});

// ── Bucket Export API types ───────────────────────────────────────

describe("BucketExportManifestEntry", () => {
  it("has correct field types", () => {
    expectTypeOf<
      BucketExportManifestEntry["entityType"]
    >().toEqualTypeOf<BucketContentEntityType>();
    expectTypeOf<BucketExportManifestEntry["count"]>().toBeNumber();
    expectTypeOf<BucketExportManifestEntry["lastUpdatedAt"]>().toEqualTypeOf<UnixMillis | null>();
  });

  it("has exact shape", () => {
    expectTypeOf<keyof BucketExportManifestEntry>().toEqualTypeOf<
      "entityType" | "count" | "lastUpdatedAt"
    >();
  });
});

describe("BucketExportManifestResponse", () => {
  it("has correct field types", () => {
    expectTypeOf<BucketExportManifestResponse["systemId"]>().toEqualTypeOf<SystemId>();
    expectTypeOf<BucketExportManifestResponse["bucketId"]>().toEqualTypeOf<BucketId>();
    expectTypeOf<BucketExportManifestResponse["entries"]>().toEqualTypeOf<
      readonly BucketExportManifestEntry[]
    >();
    expectTypeOf<BucketExportManifestResponse["etag"]>().toBeString();
  });

  it("has exact shape", () => {
    expectTypeOf<keyof BucketExportManifestResponse>().toEqualTypeOf<
      "systemId" | "bucketId" | "entries" | "etag"
    >();
  });
});

describe("BucketExportEntity", () => {
  it("has correct field types", () => {
    expectTypeOf<BucketExportEntity["id"]>().toEqualTypeOf<ExportEntityId>();
    expectTypeOf<BucketExportEntity["entityType"]>().toEqualTypeOf<BucketContentEntityType>();
    expectTypeOf<BucketExportEntity["encryptedData"]>().toBeString();
    expectTypeOf<BucketExportEntity["updatedAt"]>().toEqualTypeOf<UnixMillis>();
  });

  it("has exact shape", () => {
    expectTypeOf<keyof BucketExportEntity>().toEqualTypeOf<
      "id" | "entityType" | "encryptedData" | "updatedAt"
    >();
  });
});

describe("BucketExportPageResponse", () => {
  it("has PaginatedResult fields", () => {
    expectTypeOf<BucketExportPageResponse["items"]>().toEqualTypeOf<
      readonly BucketExportEntity[]
    >();
    expectTypeOf<BucketExportPageResponse["nextCursor"]>().toEqualTypeOf<PaginationCursor | null>();
    expectTypeOf<BucketExportPageResponse["hasMore"]>().toEqualTypeOf<boolean>();
    expectTypeOf<BucketExportPageResponse["totalCount"]>().toEqualTypeOf<number | null>();
  });

  it("has etag field", () => {
    expectTypeOf<BucketExportPageResponse["etag"]>().toBeString();
  });
});
