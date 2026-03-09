import { assertType, describe, expectTypeOf, it } from "vitest";

import type { AccountPurgeRequestId, BucketId, ImportJobId, MemberId, SystemId } from "../ids.js";
import type {
  AccountPurgeRequest,
  AccountPurgeStatus,
  DownloadableReport,
  ExportFormat,
  ExportManifest,
  ExportSection,
  ImportEntityType,
  ImportError,
  ImportJob,
  ImportJobStatus,
  ImportProgress,
  ImportSource,
  MemberReport,
  SystemOverviewReport,
  PKImportGroup,
  PKImportMember,
  PKImportPayload,
  PKImportSwitch,
  PKProxyTag,
  ReportFormat,
  SPImportBoardMessage,
  SPImportChatMessage,
  SPImportCustomField,
  SPImportCustomFieldValue,
  SPImportFriend,
  SPImportFrontingSession,
  SPImportGroup,
  SPImportMember,
  SPImportNote,
  SPImportPayload,
  SPImportPoll,
  SPImportPrivacyBucket,
  SPImportTimer,
} from "../import-export.js";
import type { UnixMillis } from "../timestamps.js";

describe("SPImportPayload", () => {
  it("uses plain string IDs and number timestamps", () => {
    expectTypeOf<SPImportMember["id"]>().toBeString();
    expectTypeOf<SPImportMember["createdAt"]>().toBeNumber();
    expectTypeOf<SPImportMember["avatarUrl"]>().toEqualTypeOf<string | null>();
    expectTypeOf<SPImportGroup["id"]>().toBeString();
    expectTypeOf<SPImportGroup["memberIds"]>().toEqualTypeOf<readonly string[]>();
    expectTypeOf<SPImportFrontingSession["memberId"]>().toBeString();
    expectTypeOf<SPImportFrontingSession["startedAt"]>().toBeNumber();
    expectTypeOf<SPImportFrontingSession["endedAt"]>().toEqualTypeOf<number | null>();
  });

  it("has correct top-level structure", () => {
    expectTypeOf<SPImportPayload["exportedAt"]>().toBeNumber();
    expectTypeOf<SPImportPayload["members"]>().toEqualTypeOf<readonly SPImportMember[]>();
    expectTypeOf<SPImportPayload["groups"]>().toEqualTypeOf<readonly SPImportGroup[]>();
    expectTypeOf<SPImportPayload["frontingHistory"]>().toEqualTypeOf<
      readonly SPImportFrontingSession[]
    >();
    expectTypeOf<SPImportPayload["customFields"]>().toEqualTypeOf<readonly SPImportCustomField[]>();
    expectTypeOf<SPImportPayload["customFieldValues"]>().toEqualTypeOf<
      readonly SPImportCustomFieldValue[]
    >();
    expectTypeOf<SPImportPayload["notes"]>().toEqualTypeOf<readonly SPImportNote[]>();
    expectTypeOf<SPImportPayload["chatMessages"]>().toEqualTypeOf<readonly SPImportChatMessage[]>();
    expectTypeOf<SPImportPayload["boardMessages"]>().toEqualTypeOf<
      readonly SPImportBoardMessage[]
    >();
    expectTypeOf<SPImportPayload["polls"]>().toEqualTypeOf<readonly SPImportPoll[]>();
    expectTypeOf<SPImportPayload["timers"]>().toEqualTypeOf<readonly SPImportTimer[]>();
    expectTypeOf<SPImportPayload["privacyBuckets"]>().toEqualTypeOf<
      readonly SPImportPrivacyBucket[]
    >();
    expectTypeOf<SPImportPayload["friends"]>().toEqualTypeOf<readonly SPImportFriend[]>();
  });
});

describe("SP import sub-types", () => {
  it("SPImportCustomField has correct fields", () => {
    expectTypeOf<SPImportCustomField["id"]>().toBeString();
    expectTypeOf<SPImportCustomField["name"]>().toBeString();
    expectTypeOf<SPImportCustomField["order"]>().toBeNumber();
    expectTypeOf<SPImportCustomField["type"]>().toBeString();
  });

  it("SPImportCustomFieldValue has correct fields", () => {
    expectTypeOf<SPImportCustomFieldValue["fieldId"]>().toBeString();
    expectTypeOf<SPImportCustomFieldValue["memberId"]>().toBeString();
    expectTypeOf<SPImportCustomFieldValue["value"]>().toBeString();
  });

  it("SPImportNote has correct fields", () => {
    expectTypeOf<SPImportNote["id"]>().toBeString();
    expectTypeOf<SPImportNote["title"]>().toBeString();
    expectTypeOf<SPImportNote["content"]>().toBeString();
    expectTypeOf<SPImportNote["memberId"]>().toEqualTypeOf<string | null>();
    expectTypeOf<SPImportNote["createdAt"]>().toBeNumber();
    expectTypeOf<SPImportNote["updatedAt"]>().toBeNumber();
  });

  it("SPImportChatMessage has correct fields", () => {
    expectTypeOf<SPImportChatMessage["id"]>().toBeString();
    expectTypeOf<SPImportChatMessage["senderId"]>().toBeString();
    expectTypeOf<SPImportChatMessage["content"]>().toBeString();
    expectTypeOf<SPImportChatMessage["createdAt"]>().toBeNumber();
  });

  it("SPImportBoardMessage has correct fields", () => {
    expectTypeOf<SPImportBoardMessage["id"]>().toBeString();
    expectTypeOf<SPImportBoardMessage["authorId"]>().toBeString();
    expectTypeOf<SPImportBoardMessage["content"]>().toBeString();
    expectTypeOf<SPImportBoardMessage["createdAt"]>().toBeNumber();
  });

  it("SPImportPoll has correct fields", () => {
    expectTypeOf<SPImportPoll["id"]>().toBeString();
    expectTypeOf<SPImportPoll["title"]>().toBeString();
    expectTypeOf<SPImportPoll["options"]>().toEqualTypeOf<readonly string[]>();
    expectTypeOf<SPImportPoll["createdAt"]>().toBeNumber();
  });

  it("SPImportTimer has correct fields", () => {
    expectTypeOf<SPImportTimer["id"]>().toBeString();
    expectTypeOf<SPImportTimer["name"]>().toBeString();
    expectTypeOf<SPImportTimer["duration"]>().toBeNumber();
    expectTypeOf<SPImportTimer["createdAt"]>().toBeNumber();
  });

  it("SPImportPrivacyBucket has correct fields", () => {
    expectTypeOf<SPImportPrivacyBucket["id"]>().toBeString();
    expectTypeOf<SPImportPrivacyBucket["name"]>().toBeString();
    expectTypeOf<SPImportPrivacyBucket["memberIds"]>().toEqualTypeOf<readonly string[]>();
  });

  it("SPImportFriend has correct fields", () => {
    expectTypeOf<SPImportFriend["id"]>().toBeString();
    expectTypeOf<SPImportFriend["friendSystemId"]>().toBeString();
    expectTypeOf<SPImportFriend["addedAt"]>().toBeNumber();
  });
});

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

describe("ImportSource", () => {
  it("accepts valid sources", () => {
    assertType<ImportSource>("simply-plural");
    assertType<ImportSource>("pluralkit");
    assertType<ImportSource>("pluralscape");
  });

  it("rejects invalid sources", () => {
    // @ts-expect-error invalid import source
    assertType<ImportSource>("tupperbox");
  });

  it("is exhaustive in a switch", () => {
    function handleSource(source: ImportSource): string {
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
        case "fronting-session":
        case "switch":
        case "custom-field":
        case "note":
        case "chat-message":
        case "board-message":
        case "poll":
        case "timer":
        case "privacy-bucket":
        case "friend":
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
  it("has correct field types", () => {
    expectTypeOf<ImportError["entityType"]>().toEqualTypeOf<ImportEntityType>();
    expectTypeOf<ImportError["entityId"]>().toEqualTypeOf<string | null>();
    expectTypeOf<ImportError["message"]>().toBeString();
    expectTypeOf<ImportError["fatal"]>().toEqualTypeOf<boolean>();
  });
});

describe("ImportJob", () => {
  it("has correct field types", () => {
    expectTypeOf<ImportJob["id"]>().toEqualTypeOf<ImportJobId>();
    expectTypeOf<ImportJob["systemId"]>().toEqualTypeOf<SystemId>();
    expectTypeOf<ImportJob["source"]>().toEqualTypeOf<ImportSource>();
    expectTypeOf<ImportJob["status"]>().toEqualTypeOf<ImportJobStatus>();
    expectTypeOf<ImportJob["progress"]>().toEqualTypeOf<ImportProgress>();
    expectTypeOf<ImportJob["startedAt"]>().toEqualTypeOf<UnixMillis | null>();
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
    expectTypeOf<AccountPurgeRequest["systemId"]>().toEqualTypeOf<SystemId>();
    expectTypeOf<AccountPurgeRequest["status"]>().toEqualTypeOf<AccountPurgeStatus>();
    expectTypeOf<AccountPurgeRequest["confirmationPhrase"]>().toBeString();
    expectTypeOf<AccountPurgeRequest["requestedAt"]>().toEqualTypeOf<UnixMillis>();
    expectTypeOf<AccountPurgeRequest["confirmedAt"]>().toEqualTypeOf<UnixMillis | null>();
    expectTypeOf<AccountPurgeRequest["scheduledPurgeAt"]>().toEqualTypeOf<UnixMillis>();
    expectTypeOf<AccountPurgeRequest["completedAt"]>().toEqualTypeOf<UnixMillis | null>();
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
