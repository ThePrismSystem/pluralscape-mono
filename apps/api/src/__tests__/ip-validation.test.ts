import { describe, expect, it } from "vitest";

import { isValidIpFormat } from "../lib/ip-validation.js";

describe("isValidIpFormat", () => {
  // ── Valid IPv4 ────────────────────────────────────────────────────
  it("accepts standard IPv4", () => {
    expect(isValidIpFormat("192.168.1.1")).toBe(true);
  });

  it("accepts loopback IPv4", () => {
    expect(isValidIpFormat("127.0.0.1")).toBe(true);
  });

  it("accepts edge-case IPv4 with high octets", () => {
    expect(isValidIpFormat("255.255.255.255")).toBe(true);
  });

  // ── Valid IPv6 ────────────────────────────────────────────────────
  it("accepts full IPv6", () => {
    expect(isValidIpFormat("2001:0db8:85a3:0000:0000:8a2e:0370:7334")).toBe(true);
  });

  it("accepts abbreviated IPv6", () => {
    expect(isValidIpFormat("::1")).toBe(true);
  });

  it("accepts IPv4-mapped IPv6", () => {
    expect(isValidIpFormat("::ffff:192.168.1.1")).toBe(true);
  });

  // ── Invalid inputs ────────────────────────────────────────────────
  it("rejects empty string", () => {
    expect(isValidIpFormat("")).toBe(false);
  });

  it("rejects plain text", () => {
    expect(isValidIpFormat("not-an-ip")).toBe(false);
  });

  it("rejects hostnames", () => {
    expect(isValidIpFormat("example.com")).toBe(false);
  });

  it("rejects script injection attempts", () => {
    expect(isValidIpFormat("<script>alert(1)</script>")).toBe(false);
  });

  it("rejects partial IPv4", () => {
    expect(isValidIpFormat("192.168.1")).toBe(false);
  });

  it("rejects IPv4 with extra octets", () => {
    expect(isValidIpFormat("1.2.3.4.5")).toBe(false);
  });
});
