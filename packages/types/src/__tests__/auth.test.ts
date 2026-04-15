import { assertType, describe, expectTypeOf, it } from "vitest";

import type {
  Account,
  AuthKey,
  AuthKeyType,
  DeviceInfo,
  DeviceTransferPayload,
  DeviceTransferRequest,
  DeviceTransferStatus,
  LoginCredentials,
  RecoveryKey,
  Session,
} from "../auth.js";
import type {
  AccountId,
  AuthKeyId,
  DeviceTransferRequestId,
  RecoveryKeyId,
  SessionId,
} from "../ids.js";
import type { UnixMillis } from "../timestamps.js";
import type { AuditMetadata } from "../utility.js";

describe("Account", () => {
  it("extends AuditMetadata", () => {
    expectTypeOf<Account>().toExtend<AuditMetadata>();
  });

  it("has expected fields", () => {
    expectTypeOf<Account["id"]>().toEqualTypeOf<AccountId>();
    expectTypeOf<Account["emailHash"]>().toEqualTypeOf<string>();
    expectTypeOf<Account["emailSalt"]>().toEqualTypeOf<string>();
    expectTypeOf<Account["authKeyHash"]>().toEqualTypeOf<Uint8Array>();
  });
});

describe("AuthKey", () => {
  it("does NOT extend AuditMetadata", () => {
    // AuthKey has createdAt but is not a versioned entity
    expectTypeOf<AuthKey>().not.toExtend<AuditMetadata>();
  });

  it("has expected fields", () => {
    expectTypeOf<AuthKey["id"]>().toEqualTypeOf<AuthKeyId>();
    expectTypeOf<AuthKey["accountId"]>().toEqualTypeOf<AccountId>();
    expectTypeOf<AuthKey["encryptedPrivateKey"]>().toEqualTypeOf<Uint8Array>();
    expectTypeOf<AuthKey["publicKey"]>().toEqualTypeOf<Uint8Array>();
    expectTypeOf<AuthKey["keyType"]>().toEqualTypeOf<AuthKeyType>();
    expectTypeOf<AuthKey["createdAt"]>().toEqualTypeOf<UnixMillis>();
  });
});

describe("AuthKeyType", () => {
  it("is exhaustive in a switch statement", () => {
    function handleKeyType(t: AuthKeyType): string {
      switch (t) {
        case "encryption":
        case "signing":
          return t;
        default: {
          const _exhaustive: never = t;
          return _exhaustive;
        }
      }
    }
    expectTypeOf(handleKeyType).toBeFunction();
  });
});

describe("Session", () => {
  it("does NOT extend AuditMetadata", () => {
    expectTypeOf<Session>().not.toExtend<AuditMetadata>();
  });

  it("has expected fields", () => {
    expectTypeOf<Session["id"]>().toEqualTypeOf<SessionId>();
    expectTypeOf<Session["accountId"]>().toEqualTypeOf<AccountId>();
    expectTypeOf<Session["createdAt"]>().toEqualTypeOf<UnixMillis>();
    expectTypeOf<Session["lastActive"]>().toEqualTypeOf<UnixMillis | null>();
    expectTypeOf<Session["revoked"]>().toEqualTypeOf<boolean>();
  });
});

describe("DeviceInfo", () => {
  it("has expected fields", () => {
    expectTypeOf<DeviceInfo["platform"]>().toEqualTypeOf<string>();
    expectTypeOf<DeviceInfo["appVersion"]>().toEqualTypeOf<string>();
    expectTypeOf<DeviceInfo["deviceName"]>().toEqualTypeOf<string>();
  });
});

describe("RecoveryKey", () => {
  it("does NOT extend AuditMetadata", () => {
    expectTypeOf<RecoveryKey>().not.toExtend<AuditMetadata>();
  });

  it("has expected fields", () => {
    expectTypeOf<RecoveryKey["id"]>().toEqualTypeOf<RecoveryKeyId>();
    expectTypeOf<RecoveryKey["accountId"]>().toEqualTypeOf<AccountId>();
    expectTypeOf<RecoveryKey["encryptedMasterKey"]>().toEqualTypeOf<Uint8Array>();
    expectTypeOf<RecoveryKey["recoveryKeyHash"]>().toEqualTypeOf<Uint8Array | null>();
    expectTypeOf<RecoveryKey["createdAt"]>().toEqualTypeOf<UnixMillis>();
    expectTypeOf<RecoveryKey["revokedAt"]>().toEqualTypeOf<UnixMillis | null>();
  });
});

describe("LoginCredentials", () => {
  it("has no id or timestamps", () => {
    expectTypeOf<LoginCredentials>().not.toHaveProperty("id");
    expectTypeOf<LoginCredentials>().not.toHaveProperty("createdAt");
  });

  it("has expected fields", () => {
    expectTypeOf<LoginCredentials["email"]>().toEqualTypeOf<string>();
    expectTypeOf<LoginCredentials["authKey"]>().toEqualTypeOf<string>();
  });
});

describe("DeviceTransferRequest", () => {
  it("has expected fields", () => {
    expectTypeOf<DeviceTransferRequest["id"]>().toEqualTypeOf<DeviceTransferRequestId>();
    expectTypeOf<DeviceTransferRequest["accountId"]>().toEqualTypeOf<AccountId>();
    expectTypeOf<DeviceTransferRequest["sourceSessionId"]>().toEqualTypeOf<SessionId>();
    expectTypeOf<DeviceTransferRequest["targetSessionId"]>().toEqualTypeOf<SessionId | null>();
    expectTypeOf<DeviceTransferRequest["createdAt"]>().toEqualTypeOf<UnixMillis>();
    expectTypeOf<DeviceTransferRequest["expiresAt"]>().toEqualTypeOf<UnixMillis>();
    expectTypeOf<DeviceTransferRequest["status"]>().toEqualTypeOf<DeviceTransferStatus>();
  });
});

describe("DeviceTransferStatus", () => {
  it("is exhaustive in a switch statement", () => {
    function handleStatus(s: DeviceTransferStatus): string {
      switch (s) {
        case "pending":
        case "approved":
        case "expired":
          return s;
        default: {
          const _exhaustive: never = s;
          return _exhaustive;
        }
      }
    }
    expectTypeOf(handleStatus).toBeFunction();
  });
});

describe("DeviceTransferPayload", () => {
  it("has expected fields", () => {
    expectTypeOf<DeviceTransferPayload["encryptedMasterKey"]>().toEqualTypeOf<Uint8Array>();
  });
});

describe("branded ID non-interchangeability", () => {
  it("AuthKeyId is not assignable from plain string", () => {
    // @ts-expect-error plain string not assignable to branded type
    assertType<AuthKeyId>("auk_test");
  });

  it("RecoveryKeyId is not assignable from plain string", () => {
    // @ts-expect-error plain string not assignable to branded type
    assertType<RecoveryKeyId>("rk_test");
  });

  it("DeviceTransferRequestId is not assignable from plain string", () => {
    // @ts-expect-error plain string not assignable to branded type
    assertType<DeviceTransferRequestId>("dtr_test");
  });

  it("AuthKeyId and RecoveryKeyId are not interchangeable", () => {
    // @ts-expect-error different branded types
    expectTypeOf<AuthKeyId>().toEqualTypeOf<RecoveryKeyId>();
  });
});
