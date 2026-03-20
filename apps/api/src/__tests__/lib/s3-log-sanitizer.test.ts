import { describe, expect, it } from "vitest";

import { sanitizeS3Error, sanitizeS3LogOutput } from "../../lib/s3-log-sanitizer.js";

describe("sanitizeS3LogOutput", () => {
  it("strips AWS access key IDs", () => {
    const input = "Failed with key AKIAIOSFODNN7EXAMPLE in request";
    expect(sanitizeS3LogOutput(input)).toBe("Failed with key [REDACTED] in request");
  });

  it("strips multiple access keys", () => {
    const input = "Keys: AKIAIOSFODNN7EXAMPLE and AKIAI44QH8DHBEXAMPLE";
    const result = sanitizeS3LogOutput(input);
    expect(result).not.toContain("AKIA");
  });

  it("strips S3 endpoint URLs", () => {
    const input = 'endpoint: "https://s3.us-east-1.amazonaws.com/my-bucket"';
    expect(sanitizeS3LogOutput(input)).toContain("[REDACTED]");
    expect(sanitizeS3LogOutput(input)).not.toContain("amazonaws.com");
  });

  it("strips secret keys in quoted assignment", () => {
    const input = 'SecretAccessKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"';
    expect(sanitizeS3LogOutput(input)).toContain("[REDACTED]");
    expect(sanitizeS3LogOutput(input)).not.toContain("wJalrXUtnFEMI");
  });

  it("returns input unchanged when no credentials present", () => {
    const input = "Connection refused to localhost:9000";
    expect(sanitizeS3LogOutput(input)).toBe(input);
  });

  it("handles empty string", () => {
    expect(sanitizeS3LogOutput("")).toBe("");
  });
});

describe("sanitizeS3Error", () => {
  it("sanitizes Error instances", () => {
    const err = new Error("Failed with AKIAIOSFODNN7EXAMPLE");
    expect(sanitizeS3Error(err)).toBe("Failed with [REDACTED]");
  });

  it("sanitizes string errors", () => {
    expect(sanitizeS3Error("Key: AKIAIOSFODNN7EXAMPLE")).toBe("Key: [REDACTED]");
  });

  it("sanitizes non-string/non-Error values", () => {
    expect(sanitizeS3Error(42)).toBe("42");
  });
});
