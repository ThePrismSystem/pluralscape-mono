import { assertType, describe, expectTypeOf, it } from "vitest";

import type { BucketId, FriendCodeId, FriendConnectionId, KeyGrantId, SystemId } from "../ids.js";
import type {
  BucketAccessCheck,
  BucketContentEntityType,
  BucketContentTag,
  BucketVisibilityScope,
  FriendBucketAssignment,
  FriendCode,
  FriendConnection,
  FriendConnectionStatus,
  FriendVisibilitySettings,
  KeyGrant,
  PrivacyBucket,
} from "../privacy.js";
import type { UnixMillis } from "../timestamps.js";
import type { AuditMetadata } from "../utility.js";

describe("PrivacyBucket", () => {
  it("extends AuditMetadata", () => {
    expectTypeOf<PrivacyBucket>().toExtend<AuditMetadata>();
  });

  it("has correct field types", () => {
    expectTypeOf<PrivacyBucket["id"]>().toEqualTypeOf<BucketId>();
    expectTypeOf<PrivacyBucket["systemId"]>().toEqualTypeOf<SystemId>();
    expectTypeOf<PrivacyBucket["name"]>().toBeString();
    expectTypeOf<PrivacyBucket["description"]>().toEqualTypeOf<string | null>();
  });
});

describe("BucketContentTag", () => {
  it("has entityType as BucketContentEntityType, entityId, and bucketId", () => {
    expectTypeOf<BucketContentTag["entityType"]>().toEqualTypeOf<BucketContentEntityType>();
    expectTypeOf<BucketContentTag["entityId"]>().toBeString();
    expectTypeOf<BucketContentTag["bucketId"]>().toEqualTypeOf<BucketId>();
  });

  it("has exact shape", () => {
    expectTypeOf<keyof BucketContentTag>().toEqualTypeOf<"entityType" | "entityId" | "bucketId">();
  });
});

describe("BucketVisibilityScope", () => {
  it("accepts all 9 valid scopes", () => {
    assertType<BucketVisibilityScope>("members");
    assertType<BucketVisibilityScope>("custom-fields");
    assertType<BucketVisibilityScope>("fronting-status");
    assertType<BucketVisibilityScope>("custom-fronts");
    assertType<BucketVisibilityScope>("notes");
    assertType<BucketVisibilityScope>("chat");
    assertType<BucketVisibilityScope>("journal-entries");
    assertType<BucketVisibilityScope>("member-photos");
    assertType<BucketVisibilityScope>("groups");
  });

  it("rejects invalid scopes", () => {
    // @ts-expect-error invalid scope
    assertType<BucketVisibilityScope>("settings");
  });

  it("is exhaustive in a switch", () => {
    function handleScope(scope: BucketVisibilityScope): string {
      switch (scope) {
        case "members":
        case "custom-fields":
        case "fronting-status":
        case "custom-fronts":
        case "notes":
        case "chat":
        case "journal-entries":
        case "member-photos":
        case "groups":
          return scope;
        default: {
          const _exhaustive: never = scope;
          return _exhaustive;
        }
      }
    }
    expectTypeOf(handleScope).toBeFunction();
  });
});

describe("KeyGrant", () => {
  it("does not extend AuditMetadata", () => {
    expectTypeOf<KeyGrant>().not.toExtend<AuditMetadata>();
  });

  it("has correct field types", () => {
    expectTypeOf<KeyGrant["id"]>().toEqualTypeOf<KeyGrantId>();
    expectTypeOf<KeyGrant["bucketId"]>().toEqualTypeOf<BucketId>();
    expectTypeOf<KeyGrant["friendUserId"]>().toEqualTypeOf<SystemId>();
    expectTypeOf<KeyGrant["encryptedBucketKey"]>().toEqualTypeOf<Uint8Array>();
    expectTypeOf<KeyGrant["createdAt"]>().toEqualTypeOf<UnixMillis>();
    expectTypeOf<KeyGrant["revokedAt"]>().toEqualTypeOf<UnixMillis | null>();
  });
});

describe("FriendConnectionStatus", () => {
  it("is exhaustive in a switch", () => {
    function handleStatus(status: FriendConnectionStatus): string {
      switch (status) {
        case "pending":
        case "accepted":
        case "blocked":
        case "removed":
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

describe("FriendConnection", () => {
  it("extends AuditMetadata", () => {
    expectTypeOf<FriendConnection>().toExtend<AuditMetadata>();
  });

  it("has correct field types", () => {
    expectTypeOf<FriendConnection["id"]>().toEqualTypeOf<FriendConnectionId>();
    expectTypeOf<FriendConnection["systemId"]>().toEqualTypeOf<SystemId>();
    expectTypeOf<FriendConnection["friendSystemId"]>().toEqualTypeOf<SystemId>();
    expectTypeOf<FriendConnection["status"]>().toEqualTypeOf<FriendConnectionStatus>();
    expectTypeOf<FriendConnection["assignedBucketIds"]>().toEqualTypeOf<readonly BucketId[]>();
    expectTypeOf<FriendConnection["visibility"]>().toEqualTypeOf<FriendVisibilitySettings>();
  });
});

describe("FriendVisibilitySettings", () => {
  it("has correct field types", () => {
    expectTypeOf<FriendVisibilitySettings["showMembers"]>().toEqualTypeOf<boolean>();
    expectTypeOf<FriendVisibilitySettings["showGroups"]>().toEqualTypeOf<boolean>();
    expectTypeOf<FriendVisibilitySettings["showStructure"]>().toEqualTypeOf<boolean>();
    expectTypeOf<FriendVisibilitySettings["allowFrontingNotifications"]>().toEqualTypeOf<boolean>();
  });

  it("has exact shape", () => {
    expectTypeOf<keyof FriendVisibilitySettings>().toEqualTypeOf<
      "showMembers" | "showGroups" | "showStructure" | "allowFrontingNotifications"
    >();
  });
});

describe("FriendCode", () => {
  it("does not extend AuditMetadata", () => {
    expectTypeOf<FriendCode>().not.toExtend<AuditMetadata>();
  });

  it("has correct field types", () => {
    expectTypeOf<FriendCode["id"]>().toEqualTypeOf<FriendCodeId>();
    expectTypeOf<FriendCode["systemId"]>().toEqualTypeOf<SystemId>();
    expectTypeOf<FriendCode["code"]>().toBeString();
    expectTypeOf<FriendCode["createdAt"]>().toEqualTypeOf<UnixMillis>();
    expectTypeOf<FriendCode["expiresAt"]>().toEqualTypeOf<UnixMillis | null>();
  });
});

describe("BucketAccessCheck", () => {
  it("has correct field types", () => {
    expectTypeOf<BucketAccessCheck["friendBucketIds"]>().toEqualTypeOf<readonly BucketId[]>();
    expectTypeOf<BucketAccessCheck["contentBucketIds"]>().toEqualTypeOf<readonly BucketId[]>();
    expectTypeOf<BucketAccessCheck["scope"]>().toEqualTypeOf<BucketVisibilityScope>();
  });
});

describe("FriendBucketAssignment", () => {
  it("has correct field types", () => {
    expectTypeOf<
      FriendBucketAssignment["friendConnectionId"]
    >().toEqualTypeOf<FriendConnectionId>();
    expectTypeOf<FriendBucketAssignment["bucketId"]>().toEqualTypeOf<BucketId>();
  });

  it("has exact shape", () => {
    expectTypeOf<keyof FriendBucketAssignment>().toEqualTypeOf<"friendConnectionId" | "bucketId">();
  });
});
