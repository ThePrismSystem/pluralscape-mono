import { assertType, describe, expectTypeOf, it } from "vitest";

import type {
  AccountId,
  AccountPurgeRequestId,
  BucketId,
  ImportEntityRefId,
  ImportJobId,
  MemberId,
  SystemId,
} from "../ids.js";
import type {
  AccountPurgeRequest,
  AccountPurgeStatus,
  DownloadableReport,
  ExportFormat,
  ExportManifest,
  ExportSection,
  ImportAvatarMode,
  ImportCheckpointState,
  ImportCollectionTotals,
  ImportCollectionType,
  ImportEntityRef,
  ImportEntityType,
  ImportError,
  ImportJob,
  ImportJobStatus,
  ImportProgress,
  ImportSourceFormat,
  MemberReport,
  SystemOverviewReport,
  PKImportGroup,
  PKImportMember,
  PKImportPayload,
  PKImportSwitch,
  PKProxyTag,
  ReportFormat,
} from "../import-export.js";
import type { UnixMillis } from "../timestamps.js";

describe("PKImportPayload", () => {
  it("uses plain string IDs and string timestamps", () => {
    expectTypeOf<PKImportMember["id"]>().toBeString();
    expectTypeOf<PKImportMember["created"]>().toBeString();
    expectTypeOf<PKImportMember["display_name"]>().toEqualTypeOf<string | null>();
    expectTypeOf<PKImportMember["color"]>().toEqualTypeOf<string | null>();
    expectTypeOf<PKImportMember["avatar_url"]>().toEqualTypeOf<string | null>();
    expectTypeOf<PKImportMember["proxy_tags"]>().toEqualTypeOf<readonly PKProxyTag[]>();
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

describe("PKProxyTag", () => {
  it("has correct field types", () => {
    expectTypeOf<PKProxyTag["prefix"]>().toEqualTypeOf<string | null>();
    expectTypeOf<PKProxyTag["suffix"]>().toEqualTypeOf<string | null>();
  });
});

describe("ImportSourceFormat", () => {
  it("accepts valid sources", () => {
    assertType<ImportSourceFormat>("simply-plural");
    assertType<ImportSourceFormat>("pluralkit");
    assertType<ImportSourceFormat>("pluralscape");
  });

  it("rejects invalid sources", () => {
    // @ts-expect-error invalid import source
    assertType<ImportSourceFormat>("tupperbox");
  });

  it("is exhaustive in a switch", () => {
    function handleSource(source: ImportSourceFormat): string {
      switch (source) {
        case "simply-plural":
        case "pluralkit":
        case "pluralscape":
          return source;
        default: {
          const _exhaustive: never = source;
          return _exhaustive;
        }
      }
    }
    expectTypeOf(handleSource).toBeFunction();
  });
});

describe("ImportEntityType", () => {
  it("is exhaustive in a switch", () => {
    function handleType(type: ImportEntityType): string {
      switch (type) {
        case "member":
        case "group":
        case "custom-front":
        case "fronting-session":
        case "fronting-comment":
        case "switch":
        case "custom-field":
        case "field-definition":
        case "field-value":
        case "note":
        case "journal-entry":
        case "chat-message":
        case "board-message":
        case "channel-category":
        case "channel":
        case "poll":
        case "timer":
        case "privacy-bucket":
        case "friend":
        case "system-profile":
        case "system-settings":
        case "unknown":
          return type;
        default: {
          const _exhaustive: never = type;
          return _exhaustive;
        }
      }
    }
    expectTypeOf(handleType).toBeFunction();
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
  it("has correct field types on the union base", () => {
    expectTypeOf<ImportError["entityType"]>().toEqualTypeOf<ImportEntityType>();
    expectTypeOf<ImportError["entityId"]>().toEqualTypeOf<string | null>();
    expectTypeOf<ImportError["message"]>().toBeString();
    expectTypeOf<ImportError["fatal"]>().toEqualTypeOf<boolean>();
  });

  it("non-fatal errors do not carry recoverable", () => {
    const err: ImportError = {
      entityType: "member",
      entityId: "abc",
      message: "validation failed",
      fatal: false,
    };
    expectTypeOf(err.fatal).toExtend<boolean>();
  });

  it("allows fatal recoverable errors (token rejected, network unreachable)", () => {
    const err: ImportError = {
      entityType: "unknown",
      entityId: null,
      message: "SP token rejected",
      fatal: true,
      recoverable: true,
    };
    expectTypeOf(err.fatal).toExtend<boolean>();
  });
});

describe("ImportJob", () => {
  it("has correct field types", () => {
    expectTypeOf<ImportJob["id"]>().toEqualTypeOf<ImportJobId>();
    expectTypeOf<ImportJob["accountId"]>().toEqualTypeOf<AccountId>();
    expectTypeOf<ImportJob["systemId"]>().toEqualTypeOf<SystemId>();
    expectTypeOf<ImportJob["source"]>().toEqualTypeOf<ImportSourceFormat>();
    expectTypeOf<ImportJob["status"]>().toEqualTypeOf<ImportJobStatus>();
    expectTypeOf<ImportJob["progressPercent"]>().toEqualTypeOf<number>();
    expectTypeOf<ImportJob["errorLog"]>().toEqualTypeOf<readonly ImportError[] | null>();
    expectTypeOf<ImportJob["warningCount"]>().toEqualTypeOf<number>();
    expectTypeOf<ImportJob["chunksTotal"]>().toEqualTypeOf<number | null>();
    expectTypeOf<ImportJob["chunksCompleted"]>().toEqualTypeOf<number>();
    expectTypeOf<ImportJob["createdAt"]>().toEqualTypeOf<UnixMillis>();
    expectTypeOf<ImportJob["updatedAt"]>().toEqualTypeOf<UnixMillis>();
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

describe("ExportSection", () => {
  it("is exhaustive in a switch", () => {
    function handleSection(section: ExportSection): string {
      switch (section) {
        case "members":
        case "groups":
        case "fronting-history":
        case "journal":
        case "custom-fields":
        case "notes":
        case "chat":
        case "board-messages":
        case "privacy-buckets":
        case "system-structure":
        case "settings":
        case "polls":
        case "lifecycle-events":
          return section;
        default: {
          const _exhaustive: never = section;
          return _exhaustive;
        }
      }
    }
    expectTypeOf(handleSection).toBeFunction();
  });
});

describe("DownloadableReport", () => {
  it("has correct field types", () => {
    expectTypeOf<DownloadableReport["generatedAt"]>().toEqualTypeOf<UnixMillis>();
    expectTypeOf<DownloadableReport["sizeBytes"]>().toEqualTypeOf<number>();
    expectTypeOf<DownloadableReport["downloadUrl"]>().toBeString();
    expectTypeOf<DownloadableReport["expiresAt"]>().toEqualTypeOf<UnixMillis>();
  });
});

describe("ExportManifest", () => {
  it("has correct field types", () => {
    expectTypeOf<ExportManifest["systemId"]>().toEqualTypeOf<SystemId>();
    expectTypeOf<ExportManifest["format"]>().toEqualTypeOf<ExportFormat>();
    expectTypeOf<ExportManifest["sections"]>().toEqualTypeOf<readonly ExportSection[]>();
    expectTypeOf<ExportManifest["generatedAt"]>().toEqualTypeOf<UnixMillis>();
    expectTypeOf<ExportManifest["sizeBytes"]>().toEqualTypeOf<number>();
    expectTypeOf<ExportManifest["downloadUrl"]>().toBeString();
    expectTypeOf<ExportManifest["expiresAt"]>().toEqualTypeOf<UnixMillis>();
  });
});

describe("ReportFormat", () => {
  it("is exhaustive in a switch", () => {
    function handleFormat(format: ReportFormat): string {
      switch (format) {
        case "html":
        case "pdf":
          return format;
        default: {
          const _exhaustive: never = format;
          return _exhaustive;
        }
      }
    }
    expectTypeOf(handleFormat).toBeFunction();
  });
});

describe("AccountPurgeStatus", () => {
  it("is exhaustive in a switch", () => {
    function handleStatus(status: AccountPurgeStatus): string {
      switch (status) {
        case "pending":
        case "confirmed":
        case "processing":
        case "completed":
        case "cancelled":
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

describe("AccountPurgeRequest", () => {
  it("has correct field types", () => {
    expectTypeOf<AccountPurgeRequest["id"]>().toEqualTypeOf<AccountPurgeRequestId>();
    expectTypeOf<AccountPurgeRequest["accountId"]>().toEqualTypeOf<AccountId>();
    expectTypeOf<AccountPurgeRequest["status"]>().toEqualTypeOf<AccountPurgeStatus>();
    expectTypeOf<AccountPurgeRequest["confirmationPhrase"]>().toBeString();
    expectTypeOf<AccountPurgeRequest["requestedAt"]>().toEqualTypeOf<UnixMillis>();
    expectTypeOf<AccountPurgeRequest["confirmedAt"]>().toEqualTypeOf<UnixMillis | null>();
    expectTypeOf<AccountPurgeRequest["scheduledPurgeAt"]>().toEqualTypeOf<UnixMillis>();
    expectTypeOf<AccountPurgeRequest["completedAt"]>().toEqualTypeOf<UnixMillis | null>();
    expectTypeOf<AccountPurgeRequest["cancelledAt"]>().toEqualTypeOf<UnixMillis | null>();
  });
});

describe("MemberReport", () => {
  it("has correct field types", () => {
    expectTypeOf<MemberReport["systemId"]>().toEqualTypeOf<SystemId>();
    expectTypeOf<MemberReport["memberId"]>().toEqualTypeOf<MemberId>();
    expectTypeOf<MemberReport["bucketId"]>().toEqualTypeOf<BucketId>();
    expectTypeOf<MemberReport["format"]>().toEqualTypeOf<ReportFormat>();
    expectTypeOf<MemberReport["generatedAt"]>().toEqualTypeOf<UnixMillis>();
    expectTypeOf<MemberReport["sizeBytes"]>().toEqualTypeOf<number>();
    expectTypeOf<MemberReport["downloadUrl"]>().toBeString();
    expectTypeOf<MemberReport["expiresAt"]>().toEqualTypeOf<UnixMillis>();
  });
});

describe("SystemOverviewReport", () => {
  it("extends DownloadableReport", () => {
    expectTypeOf<SystemOverviewReport>().toExtend<DownloadableReport>();
  });

  it("has correct field types", () => {
    expectTypeOf<SystemOverviewReport["systemId"]>().toEqualTypeOf<SystemId>();
    expectTypeOf<SystemOverviewReport["bucketId"]>().toEqualTypeOf<BucketId>();
    expectTypeOf<SystemOverviewReport["format"]>().toEqualTypeOf<ReportFormat>();
    expectTypeOf<SystemOverviewReport["generatedAt"]>().toEqualTypeOf<UnixMillis>();
    expectTypeOf<SystemOverviewReport["sizeBytes"]>().toEqualTypeOf<number>();
    expectTypeOf<SystemOverviewReport["downloadUrl"]>().toBeString();
    expectTypeOf<SystemOverviewReport["expiresAt"]>().toEqualTypeOf<UnixMillis>();
  });
});

describe("ImportCheckpointState", () => {
  it("captures resumption state with schema version 1", () => {
    const state: ImportCheckpointState = {
      schemaVersion: 1,
      checkpoint: {
        completedCollections: ["member", "group"],
        currentCollection: "fronting-session",
        currentCollectionLastSourceId: "507f1f77bcf86cd799439011",
      },
      options: {
        selectedCategories: {
          member: true,
          group: true,
          note: false,
        } as Record<ImportCollectionType, boolean | undefined>,
        avatarMode: "api",
      },
      totals: {
        perCollection: {
          member: { total: 20, imported: 20, updated: 0, skipped: 0, failed: 0 },
        } as Record<ImportCollectionType, ImportCollectionTotals | undefined>,
      },
    };
    expectTypeOf(state.schemaVersion).toEqualTypeOf<1>();
    expectTypeOf(state.checkpoint.currentCollection).toEqualTypeOf<ImportCollectionType>();
    expectTypeOf(state.options.avatarMode).toEqualTypeOf<ImportAvatarMode>();
  });
});

describe("ImportEntityRef", () => {
  it("records the mapping from a source entity ID to a Pluralscape entity ID", () => {
    const ref: ImportEntityRef = {
      id: "ier_01HX000000000000000000000A" as ImportEntityRefId,
      accountId: "acc_01HX000000000000000000000B" as AccountId,
      systemId: "sys_01HX000000000000000000000C" as SystemId,
      source: "simply-plural",
      sourceEntityType: "member",
      sourceEntityId: "507f1f77bcf86cd799439011",
      pluralscapeEntityId: "mem_01HX000000000000000000000D" as MemberId,
      importedAt: 1234567890 as UnixMillis,
    };
    expectTypeOf(ref.source).toExtend<ImportSourceFormat>();
    expectTypeOf(ref.sourceEntityType).toExtend<ImportEntityType>();
    expectTypeOf(ref.id).toEqualTypeOf<ImportEntityRefId>();
  });

  it("narrows pluralscapeEntityId by sourceEntityType discriminator", () => {
    // Distributed mapped-type check: extracting a single variant should yield
    // a type whose pluralscapeEntityId is the brand-specific ID, not the
    // joint string type. If ImportEntityRef were a flat intersection rather
    // than a distributed union, Extract<> would collapse to `never` or the
    // pluralscapeEntityId would be `string`, and these assertions would fail.
    type MemberRef = Extract<ImportEntityRef, { sourceEntityType: "member" }>;
    type GroupRef = Extract<ImportEntityRef, { sourceEntityType: "group" }>;
    type SwitchRef = Extract<ImportEntityRef, { sourceEntityType: "switch" }>;

    expectTypeOf<MemberRef["pluralscapeEntityId"]>().toEqualTypeOf<MemberId>();
    expectTypeOf<GroupRef["pluralscapeEntityId"]>().not.toEqualTypeOf<MemberId>();
    expectTypeOf<SwitchRef["pluralscapeEntityId"]>().toEqualTypeOf<string>();

    // Runtime narrowing sanity: a value typed as the wider union narrows via
    // a function parameter (avoiding literal narrowing at the declaration site).
    const narrow = (ref: ImportEntityRef): void => {
      if (ref.sourceEntityType === "member") {
        expectTypeOf(ref.pluralscapeEntityId).toEqualTypeOf<MemberId>();
      }
    };
    expectTypeOf(narrow).toBeFunction();
  });
});
