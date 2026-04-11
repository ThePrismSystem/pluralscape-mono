// scripts/sp-seed/__tests__/client.test.ts
import { describe, expect, test } from "vitest";
import { extractObjectIdFromText, InvalidObjectIdError } from "../client.js";

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
