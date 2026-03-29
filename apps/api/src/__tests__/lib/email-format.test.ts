import { describe, expect, it } from "vitest";

import { assertBasicEmailFormat } from "../../lib/email-format.js";

describe("assertBasicEmailFormat", () => {
  it("accepts a well-formed email", () => {
    expect(() => {
      assertBasicEmailFormat("user@example.com");
    }).not.toThrow();
  });

  it("accepts a minimal valid email", () => {
    expect(() => {
      assertBasicEmailFormat("a@b");
    }).not.toThrow();
  });

  it("rejects an empty string", () => {
    expect(() => {
      assertBasicEmailFormat("");
    }).toThrow("Invalid email format");
  });

  it("rejects a string with no @ symbol", () => {
    expect(() => {
      assertBasicEmailFormat("userexample.com");
    }).toThrow("Invalid email format");
  });

  it("rejects an empty local part", () => {
    expect(() => {
      assertBasicEmailFormat("@example.com");
    }).toThrow("Invalid email format");
  });

  it("rejects an empty domain part", () => {
    expect(() => {
      assertBasicEmailFormat("user@");
    }).toThrow("Invalid email format");
  });

  it("rejects @ as the only character", () => {
    expect(() => {
      assertBasicEmailFormat("@");
    }).toThrow("Invalid email format");
  });
});
