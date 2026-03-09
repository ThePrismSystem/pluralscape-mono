import { describe, expectTypeOf, it } from "vitest";

import type {
  BucketEncrypted,
  ClientFrontingSession,
  ClientGroup,
  ClientMember,
  ClientRelationship,
  ClientSubsystem,
  DecryptFn,
  Encrypted,
  EncryptedBlob,
  EncryptedString,
  EncryptFn,
  EncryptionAlgorithm,
  ServerFrontingSession,
  ServerGroup,
  ServerMember,
  ServerRelationship,
  ServerSubsystem,
} from "../encryption.js";
import type { FrontingSession } from "../fronting.js";
import type { Group } from "../groups.js";
import type { CompletenessLevel, Member } from "../identity.js";
import type { BucketId, MemberId } from "../ids.js";
import type { Relationship } from "../structure.js";
import type { Subsystem } from "../structure.js";

describe("Encrypted<T>", () => {
  it("is assignable to plain T (intersection subtype)", () => {
    // Encrypted<string> is `string & { ... }` — a subtype of string
    expectTypeOf<Encrypted<string>>().toExtend<string>();
  });

  it("is not assignable from plain T", () => {
    // Plain string is NOT assignable to Encrypted<string>
    expectTypeOf<string>().not.toExtend<Encrypted<string>>();
  });
});

describe("BucketEncrypted<T>", () => {
  it("is assignable to plain T (intersection subtype)", () => {
    expectTypeOf<BucketEncrypted<string>>().toExtend<string>();
  });

  it("is not assignable from plain T", () => {
    expectTypeOf<string>().not.toExtend<BucketEncrypted<string>>();
  });

  it("is not interchangeable with Encrypted<T>", () => {
    // @ts-expect-error different tier brands
    expectTypeOf<Encrypted<string>>().toEqualTypeOf<BucketEncrypted<string>>();
  });
});

describe("EncryptedBlob", () => {
  it("has expected fields", () => {
    expectTypeOf<EncryptedBlob["ciphertext"]>().toEqualTypeOf<Uint8Array>();
    expectTypeOf<EncryptedBlob["nonce"]>().toEqualTypeOf<Uint8Array>();
    expectTypeOf<EncryptedBlob["tier"]>().toEqualTypeOf<1 | 2>();
    expectTypeOf<EncryptedBlob["algorithm"]>().toEqualTypeOf<EncryptionAlgorithm>();
    expectTypeOf<EncryptedBlob["keyVersion"]>().toEqualTypeOf<number | null>();
    expectTypeOf<EncryptedBlob["bucketId"]>().toEqualTypeOf<BucketId | null>();
  });
});

describe("EncryptedString", () => {
  it("is not assignable from plain string", () => {
    expectTypeOf<string>().not.toExtend<EncryptedString>();
  });

  it("is assignable to plain string (intersection subtype)", () => {
    expectTypeOf<EncryptedString>().toExtend<string>();
  });
});

describe("ServerMember", () => {
  it("has encryptedData field", () => {
    expectTypeOf<ServerMember["encryptedData"]>().toEqualTypeOf<EncryptedBlob>();
  });

  it("has T3 plaintext fields", () => {
    expectTypeOf<ServerMember["completenessLevel"]>().toEqualTypeOf<CompletenessLevel>();
    expectTypeOf<ServerMember["archived"]>().toEqualTypeOf<boolean>();
  });

  it("has id and systemId", () => {
    expectTypeOf<ServerMember["id"]>().toEqualTypeOf<MemberId>();
  });
});

describe("ClientMember", () => {
  it("has flat decrypted fields matching Member", () => {
    expectTypeOf<ClientMember>().toEqualTypeOf<Member>();
  });

  it("has name as string", () => {
    expectTypeOf<ClientMember["name"]>().toEqualTypeOf<string>();
  });
});

describe("Server/Client pairs exist for completed domains", () => {
  it("fronting pair", () => {
    expectTypeOf<ServerFrontingSession>().toBeObject();
    expectTypeOf<ClientFrontingSession>().toEqualTypeOf<FrontingSession>();
  });

  it("group pair", () => {
    expectTypeOf<ServerGroup>().toBeObject();
    expectTypeOf<ClientGroup>().toEqualTypeOf<Group>();
  });

  it("subsystem pair", () => {
    expectTypeOf<ServerSubsystem>().toBeObject();
    expectTypeOf<ClientSubsystem>().toEqualTypeOf<Subsystem>();
  });

  it("relationship pair", () => {
    expectTypeOf<ServerRelationship>().toBeObject();
    expectTypeOf<ClientRelationship>().toEqualTypeOf<Relationship>();
  });
});

describe("DecryptFn and EncryptFn", () => {
  it("DecryptFn maps server to client", () => {
    type Fn = DecryptFn<ServerMember, ClientMember>;
    expectTypeOf<Fn>().toBeFunction();
    expectTypeOf<Parameters<Fn>[0]>().toEqualTypeOf<ServerMember>();
    expectTypeOf<Parameters<Fn>[1]>().toEqualTypeOf<Uint8Array>();
    expectTypeOf<ReturnType<Fn>>().toEqualTypeOf<ClientMember>();
  });

  it("EncryptFn maps client to server", () => {
    type Fn = EncryptFn<ClientMember, ServerMember>;
    expectTypeOf<Fn>().toBeFunction();
    expectTypeOf<Parameters<Fn>[0]>().toEqualTypeOf<ClientMember>();
    expectTypeOf<Parameters<Fn>[1]>().toEqualTypeOf<Uint8Array>();
    expectTypeOf<ReturnType<Fn>>().toEqualTypeOf<ServerMember>();
  });
});
