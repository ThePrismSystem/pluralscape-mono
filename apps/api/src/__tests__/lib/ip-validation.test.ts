import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { isPrivateIp, resolveAndValidateUrl } from "../../lib/ip-validation.js";

vi.mock("node:dns/promises", () => ({
  resolve4: vi.fn(),
  resolve6: vi.fn(),
}));

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

    it("allows 99.84.0.1", () => {
      expect(isPrivateIp("99.84.0.1")).toBe(false);
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

  // ── Additional reserved ranges ──────────────────────────────────────

  describe("Carrier-Grade NAT (100.64.0.0/10)", () => {
    it("detects 100.64.0.1", () => {
      expect(isPrivateIp("100.64.0.1")).toBe(true);
    });

    it("detects 100.127.255.255 (top of range)", () => {
      expect(isPrivateIp("100.127.255.255")).toBe(true);
    });

    it("does not flag 100.128.0.0 (above range)", () => {
      expect(isPrivateIp("100.128.0.0")).toBe(false);
    });

    it("does not flag 100.63.255.255 (below range)", () => {
      expect(isPrivateIp("100.63.255.255")).toBe(false);
    });
  });

  describe("Benchmarking (198.18.0.0/15)", () => {
    it("detects 198.18.0.1", () => {
      expect(isPrivateIp("198.18.0.1")).toBe(true);
    });

    it("detects 198.19.255.255 (top of range)", () => {
      expect(isPrivateIp("198.19.255.255")).toBe(true);
    });

    it("does not flag 198.20.0.0 (above range)", () => {
      expect(isPrivateIp("198.20.0.0")).toBe(false);
    });
  });

  describe("IETF protocol assignments (192.0.0.0/24)", () => {
    it("detects 192.0.0.1", () => {
      expect(isPrivateIp("192.0.0.1")).toBe(true);
    });

    it("does not flag 192.0.1.0 (above range)", () => {
      expect(isPrivateIp("192.0.1.0")).toBe(false);
    });
  });

  describe("TEST-NET-1 (192.0.2.0/24)", () => {
    it("detects 192.0.2.1", () => {
      expect(isPrivateIp("192.0.2.1")).toBe(true);
    });
  });

  describe("TEST-NET-2 (198.51.100.0/24)", () => {
    it("detects 198.51.100.1", () => {
      expect(isPrivateIp("198.51.100.1")).toBe(true);
    });
  });

  describe("TEST-NET-3 (203.0.113.0/24)", () => {
    it("detects 203.0.113.1", () => {
      expect(isPrivateIp("203.0.113.1")).toBe(true);
    });
  });

  describe("Reserved for future use (240.0.0.0/4)", () => {
    it("detects 240.0.0.1", () => {
      expect(isPrivateIp("240.0.0.1")).toBe(true);
    });

    it("detects 255.255.255.254", () => {
      expect(isPrivateIp("255.255.255.254")).toBe(true);
    });
  });

  describe("Broadcast (255.255.255.255/32)", () => {
    it("detects 255.255.255.255", () => {
      expect(isPrivateIp("255.255.255.255")).toBe(true);
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

// ── resolveAndValidateUrl ─────────────────────────────────────────────

describe("resolveAndValidateUrl", () => {
  let resolve4: ReturnType<typeof vi.fn>;
  let resolve6: ReturnType<typeof vi.fn>;

  beforeAll(async () => {
    const dns = await import("node:dns/promises");
    resolve4 = vi.mocked(dns.resolve4) as ReturnType<typeof vi.fn>;
    resolve6 = vi.mocked(dns.resolve6) as ReturnType<typeof vi.fn>;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("accepts hostname resolving to public IP", async () => {
    resolve4.mockResolvedValueOnce(["93.184.216.34"]);
    resolve6.mockRejectedValueOnce(new Error("ENODATA"));

    const result = await resolveAndValidateUrl("https://example.com/webhook");
    expect(result).toEqual(["93.184.216.34"]);
  });

  it("returns all resolved IPs on success", async () => {
    resolve4.mockResolvedValueOnce(["93.184.216.34"]);
    resolve6.mockResolvedValueOnce(["2606:2800:220:1:248:1893:25c8:1946"]);

    const result = await resolveAndValidateUrl("https://example.com/webhook");
    expect(result).toEqual(["93.184.216.34", "2606:2800:220:1:248:1893:25c8:1946"]);
  });

  it("rejects URL resolving to private IPv4", async () => {
    resolve4.mockResolvedValueOnce(["10.0.0.1"]);
    resolve6.mockRejectedValueOnce(new Error("ENODATA"));

    await expect(resolveAndValidateUrl("https://internal.example.com/hook")).rejects.toThrow(
      "Webhook URL must not resolve to a private or reserved IP address",
    );
  });

  it("rejects URL resolving to private IPv6", async () => {
    resolve4.mockRejectedValueOnce(new Error("ENODATA"));
    resolve6.mockResolvedValueOnce(["fc00::1"]);

    await expect(resolveAndValidateUrl("https://internal.example.com/hook")).rejects.toThrow(
      "Webhook URL must not resolve to a private or reserved IP address",
    );
  });

  it("rejects unresolvable hostname", async () => {
    resolve4.mockRejectedValueOnce(new Error("ENOTFOUND"));
    resolve6.mockRejectedValueOnce(new Error("ENOTFOUND"));

    await expect(resolveAndValidateUrl("https://nonexistent.invalid/hook")).rejects.toThrow(
      "Webhook URL hostname could not be resolved",
    );
  });

  it("rejects invalid URL", async () => {
    await expect(resolveAndValidateUrl("not a url")).rejects.toThrow(
      "Webhook URL is not a valid URL",
    );
  });

  it("rejects when any resolved IP is private (mixed public and private)", async () => {
    resolve4.mockResolvedValueOnce(["93.184.216.34", "192.168.1.1"]);
    resolve6.mockRejectedValueOnce(new Error("ENODATA"));

    await expect(resolveAndValidateUrl("https://example.com/hook")).rejects.toThrow(
      "Webhook URL must not resolve to a private or reserved IP address",
    );
  });
});
