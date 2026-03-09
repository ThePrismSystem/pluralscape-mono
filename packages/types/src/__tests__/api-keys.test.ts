import { assertType, describe, expectTypeOf, it } from "vitest";

import type {
  ApiKey,
  ApiKeyScope,
  ApiKeyToken,
  ApiKeyWithSecret,
  CryptoApiKey,
  MetadataApiKey,
} from "../api-keys.js";
import type { ApiKeyId, SystemId } from "../ids.js";
import type { UnixMillis } from "../timestamps.js";
import type { AuditMetadata } from "../utility.js";

describe("ApiKeyToken", () => {
  it("extends string", () => {
    expectTypeOf<ApiKeyToken>().toExtend<string>();
  });

  it("is not assignable from plain string", () => {
    // @ts-expect-error plain string not assignable to ApiKeyToken
    assertType<ApiKeyToken>("ak_token_123");
  });
});

describe("ApiKeyScope", () => {
  it("accepts valid scopes", () => {
    assertType<ApiKeyScope>("read:members");
    assertType<ApiKeyScope>("write:members");
    assertType<ApiKeyScope>("full");
  });

  it("rejects invalid scopes", () => {
    // @ts-expect-error invalid scope
    assertType<ApiKeyScope>("admin");
  });

  it("is exhaustive in a switch", () => {
    function handleScope(scope: ApiKeyScope): string {
      switch (scope) {
        case "read:members":
        case "write:members":
        case "read:fronting":
        case "write:fronting":
        case "read:groups":
        case "write:groups":
        case "read:system":
        case "write:system":
        case "read:webhooks":
        case "write:webhooks":
        case "read:audit-log":
        case "read:blobs":
        case "write:blobs":
        case "read:notifications":
        case "write:notifications":
        case "full":
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

describe("MetadataApiKey", () => {
  it("extends AuditMetadata", () => {
    expectTypeOf<MetadataApiKey>().toExtend<AuditMetadata>();
  });

  it("has correct field types", () => {
    expectTypeOf<MetadataApiKey["id"]>().toEqualTypeOf<ApiKeyId>();
    expectTypeOf<MetadataApiKey["systemId"]>().toEqualTypeOf<SystemId>();
    expectTypeOf<MetadataApiKey["keyType"]>().toEqualTypeOf<"metadata">();
    expectTypeOf<MetadataApiKey["name"]>().toBeString();
    expectTypeOf<MetadataApiKey["scopes"]>().toEqualTypeOf<readonly ApiKeyScope[]>();
    expectTypeOf<MetadataApiKey["expiresAt"]>().toEqualTypeOf<UnixMillis | null>();
    expectTypeOf<MetadataApiKey["lastUsedAt"]>().toEqualTypeOf<UnixMillis | null>();
    expectTypeOf<MetadataApiKey["revoked"]>().toEqualTypeOf<boolean>();
  });
});

describe("CryptoApiKey", () => {
  it("extends AuditMetadata", () => {
    expectTypeOf<CryptoApiKey>().toExtend<AuditMetadata>();
  });

  it("has keyType crypto and publicKey", () => {
    expectTypeOf<CryptoApiKey["keyType"]>().toEqualTypeOf<"crypto">();
    expectTypeOf<CryptoApiKey["publicKey"]>().toEqualTypeOf<Uint8Array>();
  });
});

describe("ApiKey", () => {
  it("discriminates on keyType", () => {
    function handleKey(key: ApiKey): string {
      if (key.keyType === "metadata") {
        expectTypeOf(key).toEqualTypeOf<MetadataApiKey>();
        return key.name;
      }
      expectTypeOf(key).toEqualTypeOf<CryptoApiKey>();
      return key.name;
    }
    expectTypeOf(handleKey).toBeFunction();
  });
});

describe("ApiKeyWithSecret", () => {
  it("has key and token fields", () => {
    expectTypeOf<ApiKeyWithSecret["key"]>().toEqualTypeOf<ApiKey>();
    expectTypeOf<ApiKeyWithSecret["token"]>().toEqualTypeOf<ApiKeyToken>();
  });
});
