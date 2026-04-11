// scripts/sp-seed/__tests__/client.test.ts
import { describe, expect, test } from "vitest";
import {
  extractObjectIdFromText,
  InvalidObjectIdError,
  MalformedJwtError,
  uidFromJwt,
} from "../client.js";

describe("extractObjectIdFromText", () => {
  test("returns the string when it is a valid 24-char hex", () => {
    expect(extractObjectIdFromText("507f1f77bcf86cd799439011")).toBe("507f1f77bcf86cd799439011");
  });

  test("accepts both lower- and upper-case hex", () => {
    expect(extractObjectIdFromText("507F1F77BCF86CD799439011")).toBe("507F1F77BCF86CD799439011");
  });

  test("throws InvalidObjectIdError on wrong length", () => {
    expect(() => extractObjectIdFromText("507f1f77bcf86cd79943901")).toThrow(InvalidObjectIdError);
  });

  test("throws InvalidObjectIdError on non-hex content", () => {
    expect(() => extractObjectIdFromText("not-an-object-id-xxxxxxx")).toThrow(InvalidObjectIdError);
  });

  test("throws InvalidObjectIdError on JSON-looking content", () => {
    expect(() => extractObjectIdFromText('{"id":"507f"}')).toThrow(InvalidObjectIdError);
  });

  test("throws on empty string", () => {
    expect(() => extractObjectIdFromText("")).toThrow(InvalidObjectIdError);
  });
});

describe("uidFromJwt", () => {
  // Helper to build a JWT-shaped string with a given payload JSON object.
  function makeJwt(payload: Record<string, unknown>): string {
    const header = Buffer.from('{"alg":"HS256","typ":"JWT"}').toString("base64url");
    const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
    return `${header}.${body}.fake-signature`;
  }

  test("extracts uid from `sub` claim", () => {
    const jwt = makeJwt({ sub: "abc123" });
    expect(uidFromJwt(jwt)).toBe("abc123");
  });

  test("extracts uid from `uid` claim when `sub` missing", () => {
    const jwt = makeJwt({ uid: "xyz789" });
    expect(uidFromJwt(jwt)).toBe("xyz789");
  });

  test("prefers `sub` over `uid` when both present", () => {
    const jwt = makeJwt({ sub: "from-sub", uid: "from-uid" });
    expect(uidFromJwt(jwt)).toBe("from-sub");
  });

  test("throws MalformedJwtError when payload segment is missing", () => {
    expect(() => uidFromJwt("onlyonesegment")).toThrow(MalformedJwtError);
  });

  test("throws MalformedJwtError when payload segment is empty", () => {
    expect(() => uidFromJwt("header..signature")).toThrow(MalformedJwtError);
  });

  test("throws MalformedJwtError when payload has neither sub nor uid", () => {
    const jwt = makeJwt({ other: "value" });
    expect(() => uidFromJwt(jwt)).toThrow(MalformedJwtError);
  });

  test("throws MalformedJwtError when payload is not valid base64url JSON", () => {
    expect(() => uidFromJwt("header.not-valid-json-base64.sig")).toThrow(MalformedJwtError);
  });
});
