import { assertType, describe, expectTypeOf, it } from "vitest";

import type { SystemId } from "../ids.js";
import type {
  AccountPurgeRequest,
  ExportFormat,
  ExportManifest,
  ImportError,
  ImportJob,
  ImportJobStatus,
  ImportProgress,
  ImportSource,
  MemberReport,
  PKImportGroup,
  PKImportMember,
  PKImportPayload,
  PKImportSwitch,
  SPImportFrontingSession,
  SPImportGroup,
  SPImportMember,
  SPImportPayload,
} from "../import-export.js";
import type { UnixMillis } from "../timestamps.js";

describe("SPImportPayload", () => {
  it("uses plain string IDs and number timestamps", () => {
    expectTypeOf<SPImportMember["id"]>().toBeString();
    expectTypeOf<SPImportMember["createdAt"]>().toBeNumber();
    expectTypeOf<SPImportGroup["id"]>().toBeString();
    expectTypeOf<SPImportGroup["memberIds"]>().toEqualTypeOf<readonly string[]>();
    expectTypeOf<SPImportFrontingSession["memberId"]>().toBeString();
    expectTypeOf<SPImportFrontingSession["startedAt"]>().toBeNumber();
    expectTypeOf<SPImportFrontingSession["endedAt"]>().toEqualTypeOf<number | null>();
  });

  it("has correct top-level structure", () => {
    expectTypeOf<SPImportPayload["version"]>().toBeNumber();
    expectTypeOf<SPImportPayload["exportedAt"]>().toBeNumber();
    expectTypeOf<SPImportPayload["members"]>().toEqualTypeOf<readonly SPImportMember[]>();
    expectTypeOf<SPImportPayload["groups"]>().toEqualTypeOf<readonly SPImportGroup[]>();
    expectTypeOf<SPImportPayload["frontingHistory"]>().toEqualTypeOf<
      readonly SPImportFrontingSession[]
    >();
  });
});

describe("PKImportPayload", () => {
  it("uses plain string IDs and string timestamps", () => {
    expectTypeOf<PKImportMember["id"]>().toBeString();
    expectTypeOf<PKImportMember["created"]>().toBeString();
    expectTypeOf<PKImportMember["display_name"]>().toEqualTypeOf<string | null>();
    expectTypeOf<PKImportMember["color"]>().toEqualTypeOf<string | null>();
    expectTypeOf<PKImportGroup["id"]>().toBeString();
    expectTypeOf<PKImportGroup["members"]>().toEqualTypeOf<readonly string[]>();
    expectTypeOf<PKImportSwitch["timestamp"]>().toBeString();
    expectTypeOf<PKImportSwitch["members"]>().toEqualTypeOf<readonly string[]>();
  });

  it("has correct top-level structure", () => {
    expectTypeOf<PKImportPayload["version"]>().toBeNumber();
    expectTypeOf<PKImportPayload["id"]>().toBeString();
    expectTypeOf<PKImportPayload["name"]>().toBeString();
    expectTypeOf<PKImportPayload["members"]>().toEqualTypeOf<readonly PKImportMember[]>();
    expectTypeOf<PKImportPayload["groups"]>().toEqualTypeOf<readonly PKImportGroup[]>();
    expectTypeOf<PKImportPayload["switches"]>().toEqualTypeOf<readonly PKImportSwitch[]>();
  });
});

describe("ImportSource", () => {
  it("accepts valid sources", () => {
    assertType<ImportSource>("pluralscape");
    assertType<ImportSource>("pluralkit");
  });

  it("rejects invalid sources", () => {
    // @ts-expect-error invalid import source
    assertType<ImportSource>("simplyplural");
  });
});

describe("ImportJobStatus", () => {
  it("accepts valid statuses", () => {
    assertType<ImportJobStatus>("pending");
    assertType<ImportJobStatus>("validating");
    assertType<ImportJobStatus>("importing");
    assertType<ImportJobStatus>("completed");
    assertType<ImportJobStatus>("failed");
  });

  it("rejects invalid statuses", () => {
    // @ts-expect-error invalid import job status
    assertType<ImportJobStatus>("queued");
  });

  it("is exhaustive in a switch", () => {
    function handleStatus(status: ImportJobStatus): string {
      switch (status) {
        case "pending":
        case "validating":
        case "importing":
        case "completed":
        case "failed":
          return status;
        default: {
          const _exhaustive: never = status;
          return _exhaustive;
        }
      }
    }
    expectTypeOf(handleStatus).toBeFunction();
  });
});

describe("ImportProgress", () => {
  it("has correct field types", () => {
    expectTypeOf<ImportProgress["totalItems"]>().toEqualTypeOf<number>();
    expectTypeOf<ImportProgress["processedItems"]>().toEqualTypeOf<number>();
    expectTypeOf<ImportProgress["skippedItems"]>().toEqualTypeOf<number>();
    expectTypeOf<ImportProgress["errors"]>().toEqualTypeOf<readonly ImportError[]>();
  });
});

describe("ImportError", () => {
  it("has correct field types", () => {
    expectTypeOf<ImportError["entityType"]>().toBeString();
    expectTypeOf<ImportError["entityId"]>().toEqualTypeOf<string | null>();
    expectTypeOf<ImportError["message"]>().toBeString();
    expectTypeOf<ImportError["fatal"]>().toEqualTypeOf<boolean>();
  });
});

describe("ImportJob", () => {
  it("has correct field types", () => {
    expectTypeOf<ImportJob["id"]>().toBeString();
    expectTypeOf<ImportJob["systemId"]>().toEqualTypeOf<SystemId>();
    expectTypeOf<ImportJob["source"]>().toEqualTypeOf<ImportSource>();
    expectTypeOf<ImportJob["status"]>().toEqualTypeOf<ImportJobStatus>();
    expectTypeOf<ImportJob["progress"]>().toEqualTypeOf<ImportProgress>();
    expectTypeOf<ImportJob["startedAt"]>().toEqualTypeOf<UnixMillis>();
    expectTypeOf<ImportJob["completedAt"]>().toEqualTypeOf<UnixMillis | null>();
  });
});

describe("ExportFormat", () => {
  it("accepts valid formats", () => {
    assertType<ExportFormat>("json");
    assertType<ExportFormat>("csv");
  });

  it("rejects invalid formats", () => {
    // @ts-expect-error invalid export format
    assertType<ExportFormat>("xml");
  });
});

describe("ExportManifest", () => {
  it("has correct field types", () => {
    expectTypeOf<ExportManifest["systemId"]>().toEqualTypeOf<SystemId>();
    expectTypeOf<ExportManifest["format"]>().toEqualTypeOf<ExportFormat>();
    expectTypeOf<ExportManifest["includeMembers"]>().toEqualTypeOf<boolean>();
    expectTypeOf<ExportManifest["includeGroups"]>().toEqualTypeOf<boolean>();
    expectTypeOf<ExportManifest["includeFrontingHistory"]>().toEqualTypeOf<boolean>();
    expectTypeOf<ExportManifest["includeJournal"]>().toEqualTypeOf<boolean>();
    expectTypeOf<ExportManifest["generatedAt"]>().toEqualTypeOf<UnixMillis>();
    expectTypeOf<ExportManifest["sizeBytes"]>().toEqualTypeOf<number>();
    expectTypeOf<ExportManifest["downloadUrl"]>().toBeString();
    expectTypeOf<ExportManifest["expiresAt"]>().toEqualTypeOf<UnixMillis>();
  });
});

describe("AccountPurgeRequest", () => {
  it("has correct field types", () => {
    expectTypeOf<AccountPurgeRequest["systemId"]>().toEqualTypeOf<SystemId>();
    expectTypeOf<AccountPurgeRequest["confirmationPhrase"]>().toBeString();
    expectTypeOf<AccountPurgeRequest["requestedAt"]>().toEqualTypeOf<UnixMillis>();
    expectTypeOf<AccountPurgeRequest["scheduledPurgeAt"]>().toEqualTypeOf<UnixMillis>();
    expectTypeOf<AccountPurgeRequest["cancelled"]>().toEqualTypeOf<boolean>();
  });
});

describe("MemberReport", () => {
  it("has correct field types", () => {
    expectTypeOf<MemberReport["systemId"]>().toEqualTypeOf<SystemId>();
    expectTypeOf<MemberReport["memberId"]>().toBeString();
    expectTypeOf<MemberReport["generatedAt"]>().toEqualTypeOf<UnixMillis>();
    expectTypeOf<MemberReport["sizeBytes"]>().toEqualTypeOf<number>();
    expectTypeOf<MemberReport["downloadUrl"]>().toBeString();
    expectTypeOf<MemberReport["expiresAt"]>().toEqualTypeOf<UnixMillis>();
  });
});
