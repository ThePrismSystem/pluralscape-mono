import { describe, expect, it } from "vitest";

import { isPrivateIp } from "../../lib/ip-validation.js";

describe("isPrivateIp", () => {
  // ── IPv4 private ranges ─────────────────────────────────────────────

  describe("IPv4 loopback (127.0.0.0/8)", () => {
    it("detects 127.0.0.1", () => {
      expect(isPrivateIp("127.0.0.1")).toBe(true);
    });

    it("detects 127.255.255.255", () => {
      expect(isPrivateIp("127.255.255.255")).toBe(true);
    });

    it("detects 127.0.0.0", () => {
      expect(isPrivateIp("127.0.0.0")).toBe(true);
    });
  });

  describe("IPv4 Class A private (10.0.0.0/8)", () => {
    it("detects 10.0.0.1", () => {
      expect(isPrivateIp("10.0.0.1")).toBe(true);
    });

    it("detects 10.255.255.255", () => {
      expect(isPrivateIp("10.255.255.255")).toBe(true);
    });
  });

  describe("IPv4 Class B private (172.16.0.0/12)", () => {
    it("detects 172.16.0.1", () => {
      expect(isPrivateIp("172.16.0.1")).toBe(true);
    });

    it("detects 172.31.255.255", () => {
      expect(isPrivateIp("172.31.255.255")).toBe(true);
    });

    it("does not flag 172.32.0.1 (outside range)", () => {
      expect(isPrivateIp("172.32.0.1")).toBe(false);
    });

    it("does not flag 172.15.255.255 (below range)", () => {
      expect(isPrivateIp("172.15.255.255")).toBe(false);
    });
  });

  describe("IPv4 Class C private (192.168.0.0/16)", () => {
    it("detects 192.168.0.1", () => {
      expect(isPrivateIp("192.168.0.1")).toBe(true);
    });

    it("detects 192.168.255.255", () => {
      expect(isPrivateIp("192.168.255.255")).toBe(true);
    });
  });

  describe("IPv4 link-local (169.254.0.0/16)", () => {
    it("detects 169.254.0.1", () => {
      expect(isPrivateIp("169.254.0.1")).toBe(true);
    });

    it("detects 169.254.169.254 (AWS metadata)", () => {
      expect(isPrivateIp("169.254.169.254")).toBe(true);
    });
  });

  describe('IPv4 "this network" (0.0.0.0/8)', () => {
    it("detects 0.0.0.0", () => {
      expect(isPrivateIp("0.0.0.0")).toBe(true);
    });

    it("detects 0.255.255.255", () => {
      expect(isPrivateIp("0.255.255.255")).toBe(true);
    });
  });

  // ── IPv6 private ranges ─────────────────────────────────────────────

  describe("IPv6 loopback (::1)", () => {
    it("detects ::1", () => {
      expect(isPrivateIp("::1")).toBe(true);
    });
  });

  describe("IPv6 unique local (fc00::/7)", () => {
    it("detects fc00::1", () => {
      expect(isPrivateIp("fc00::1")).toBe(true);
    });

    it("detects fd00::1", () => {
      expect(isPrivateIp("fd00::1")).toBe(true);
    });

    it("detects fdff:ffff:ffff:ffff:ffff:ffff:ffff:ffff", () => {
      expect(isPrivateIp("fdff:ffff:ffff:ffff:ffff:ffff:ffff:ffff")).toBe(true);
    });
  });

  describe("IPv6 link-local (fe80::/10)", () => {
    it("detects fe80::1", () => {
      expect(isPrivateIp("fe80::1")).toBe(true);
    });

    it("detects febf:ffff:ffff:ffff:ffff:ffff:ffff:ffff", () => {
      expect(isPrivateIp("febf:ffff:ffff:ffff:ffff:ffff:ffff:ffff")).toBe(true);
    });
  });

  describe("IPv6 unspecified (::)", () => {
    it("detects ::", () => {
      expect(isPrivateIp("::")).toBe(true);
    });
  });

  // ── IPv4-mapped IPv6 ───────────────────────────────────────────────

  describe("IPv4-mapped IPv6", () => {
    it("detects ::ffff:127.0.0.1", () => {
      expect(isPrivateIp("::ffff:127.0.0.1")).toBe(true);
    });

    it("detects ::ffff:10.0.0.1", () => {
      expect(isPrivateIp("::ffff:10.0.0.1")).toBe(true);
    });

    it("detects ::ffff:192.168.1.1", () => {
      expect(isPrivateIp("::ffff:192.168.1.1")).toBe(true);
    });

    it("allows ::ffff:8.8.8.8 (public)", () => {
      expect(isPrivateIp("::ffff:8.8.8.8")).toBe(false);
    });
  });

  // ── Public IPs ─────────────────────────────────────────────────────

  describe("public IPv4 addresses", () => {
    it("allows 8.8.8.8", () => {
      expect(isPrivateIp("8.8.8.8")).toBe(false);
    });

    it("allows 1.1.1.1", () => {
      expect(isPrivateIp("1.1.1.1")).toBe(false);
    });

    it("allows 93.184.216.34", () => {
      expect(isPrivateIp("93.184.216.34")).toBe(false);
    });

    it("allows 203.0.113.1", () => {
      expect(isPrivateIp("203.0.113.1")).toBe(false);
    });
  });

  describe("public IPv6 addresses", () => {
    it("allows 2001:4860:4860::8888 (Google DNS)", () => {
      expect(isPrivateIp("2001:4860:4860::8888")).toBe(false);
    });

    it("allows 2606:4700:4700::1111 (Cloudflare DNS)", () => {
      expect(isPrivateIp("2606:4700:4700::1111")).toBe(false);
    });
  });

  // ── Edge cases ─────────────────────────────────────────────────────

  describe("edge cases", () => {
    it("returns true for empty string (fail-closed)", () => {
      expect(isPrivateIp("")).toBe(true);
    });

    it("returns true for invalid format (fail-closed)", () => {
      expect(isPrivateIp("not-an-ip")).toBe(true);
    });

    it("returns true for hostnames (fail-closed)", () => {
      expect(isPrivateIp("example.com")).toBe(true);
    });
  });
});
