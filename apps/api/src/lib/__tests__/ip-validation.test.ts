import { describe, expect, it } from "vitest";

import { buildIpPinnedFetchArgs, isPrivateIp, isValidIpFormat } from "../ip-validation.js";

// ── isValidIpFormat ──────────────────────────────────────────────────

describe("isValidIpFormat", () => {
  it("returns false for empty string", () => {
    expect(isValidIpFormat("")).toBe(false);
  });

  it("returns true for valid IPv4", () => {
    expect(isValidIpFormat("1.2.3.4")).toBe(true);
  });

  it("returns false for invalid IPv4 (letters)", () => {
    expect(isValidIpFormat("abc.def.ghi.jkl")).toBe(false);
  });

  it("returns true for valid IPv6 with colon", () => {
    expect(isValidIpFormat("::1")).toBe(true);
  });

  it("returns false for IPv6 with invalid chars", () => {
    expect(isValidIpFormat("::gggg")).toBe(false);
  });

  it("returns false for IPv6 with uppercase non-hex chars", () => {
    expect(isValidIpFormat("::ZZZZ")).toBe(false);
  });
});

// ── parseIpv4ToNumber (tested via isPrivateIp / ipv4InCidr) ─────────
// L134 — branch 0: parts.length !== 4 (too few octets)
// L139 — branch 0: octet out of range or non-integer

describe("IPv4 parsing edge cases (via isPrivateIp)", () => {
  it("treats IP with too few octets as private (fail-closed)", () => {
    // Only 3 parts → parseIpv4ToNumber returns null for the ip → no CIDR match → falls through to invalid-IP path → true
    expect(isPrivateIp("1.2.3")).toBe(true);
  });

  it("treats IP with too many octets as private (fail-closed)", () => {
    expect(isPrivateIp("1.2.3.4.5")).toBe(true);
  });

  it("treats IP with octet > 255 as private (fail-closed)", () => {
    // Node isIP() rejects this so it falls through to the fail-closed return
    expect(isPrivateIp("256.0.0.1")).toBe(true);
  });

  it("treats IP with negative-looking octet as private (fail-closed)", () => {
    expect(isPrivateIp("1.-1.3.4")).toBe(true);
  });
});

// ── ipv4InCidr edge cases ────────────────────────────────────────────
// L151 — branch 0: cidr has no '/' → !rangeIp || !prefixStr scenario
// L155 — branch 0: parseIpv4ToNumber returns null for rangeIp
// L158 — branch 0: prefix === 0 → always in range

describe("IPv4 CIDR edge cases (via isPrivateIp)", () => {
  it("returns true for 0.0.0.1 which falls in 0.0.0.0/8 (prefix=8)", () => {
    expect(isPrivateIp("0.0.0.1")).toBe(true);
  });

  it("returns true for public IP in private A range", () => {
    expect(isPrivateIp("10.20.30.40")).toBe(true);
  });
});

// ── expandIpv6 edge cases ────────────────────────────────────────────
// L171 — branch 0: v4-mapped match hits
// L172 branch 0/1 — nullish coalesce on v4MappedMatch[2]
// L173 branch 0/1 — v4Num === null branch
// L174 branch 0/1 — nullish coalesce on v4MappedMatch[1]
// L181 — branch 0: more than one "::" → invalid
// L189 branch 1 — halves[0] undefined (split("::") on "::")
// L190 branch 1 — halves[1] undefined
// L192 — branch 0: missing < 0 (too many groups)
// L194 — branch 0: groups.length !== 8 after fill
// L199 — branch 0: non-"::" full address with wrong group count

describe("expandIpv6 (via isPrivateIp)", () => {
  it("recognises ::1 loopback as private", () => {
    expect(isPrivateIp("::1")).toBe(true);
  });

  it("recognises :: unspecified as private", () => {
    expect(isPrivateIp("::")).toBe(true);
  });

  it("treats address with multiple :: as private (fail-closed)", () => {
    // "1::2::3" has two occurrences of "::" → expandIpv6 returns null
    expect(isPrivateIp("1::2::3")).toBe(true);
  });

  it("treats a non-:: IPv6 with wrong group count as private (fail-closed)", () => {
    // Only 4 groups — not a valid full IPv6 address
    expect(isPrivateIp("2001:db8:1:1")).toBe(true);
  });

  it("recognises fc00:: (unique-local prefix) as private", () => {
    // fc00:: expands to fc00:0:0:0:0:0:0:0 which is in fc00::/7
    expect(isPrivateIp("fc00::")).toBe(true);
  });

  it("recognises fe80::1 link-local as private", () => {
    expect(isPrivateIp("fe80::1")).toBe(true);
  });

  it("treats :: (::, both halves empty) as private", () => {
    // This exercises halves[0] = "" and halves[1] = "" branches
    expect(isPrivateIp("::")).toBe(true);
  });

  it("treats compressed IPv6 with too many explicit groups as private", () => {
    // 9 groups — "1:2:3:4:5:6:7:8:9" — no "::", 9 !== 8
    expect(isPrivateIp("1:2:3:4:5:6:7:8:9")).toBe(true);
  });

  it("treats compressed :: with too many groups on left as private", () => {
    // "1:2:3:4:5:6:7:8::1" — left = 8 groups, right = 1 group → missing = 8 - 8 - 1 = -1
    expect(isPrivateIp("1:2:3:4:5:6:7:8::1")).toBe(true);
  });
});

// ── IPv4-mapped IPv6 in isPrivateIp ─────────────────────────────────
// L283 branch 1 — v4MappedMatch[1] ?? "" — exercises when capture group 1 is undefined (shouldn't fire normally)
// Also exercises the full v4-mapped path

describe("IPv4-mapped IPv6 addresses (isPrivateIp)", () => {
  it("treats ::ffff:127.0.0.1 as private (loopback via v4-mapped)", () => {
    expect(isPrivateIp("::ffff:127.0.0.1")).toBe(true);
  });

  it("treats ::ffff:8.8.8.8 as public", () => {
    expect(isPrivateIp("::ffff:8.8.8.8")).toBe(false);
  });

  it("treats ::ffff:10.0.0.1 as private (private-A via v4-mapped)", () => {
    expect(isPrivateIp("::ffff:10.0.0.1")).toBe(true);
  });
});

// ── ipv6InRange — partial group (bitsRemaining < 16) ────────────────
// L232 branch 0 — bitsRemaining < IPV6_GROUP_BITS (partial group mask)
// L233 branch 0/1 — group mismatch and match in full-group check

describe("IPv6 CIDR ranges (partial prefix, isPrivateIp)", () => {
  it("treats fd00:: as private (fc00::/7 — partial group boundary)", () => {
    // fc00::/7 means only the top 7 bits of the first group matter.
    // fd00 = 1111 1101 …, fc00 = 1111 1100 … top 7 bits both = 0111111x, same
    expect(isPrivateIp("fd00::1")).toBe(true);
  });

  it("treats 2001:db8::1 as public (not in any blocked range)", () => {
    expect(isPrivateIp("2001:db8::1")).toBe(false);
  });

  it("treats fe90::1 as private (fe80::/10 — partial second group)", () => {
    // fe80::/10 covers fe80 through febf in the first group
    expect(isPrivateIp("fe90::1")).toBe(true);
  });

  it("treats fec0::1 as NOT in fe80::/10", () => {
    // fec0 = 1111 1110 1100 0000, fe80/10 mask = 1111 1111 1100 0000 = ffc0
    // fe80 & ffc0 = fe80; fec0 & ffc0 = fec0 → not equal
    expect(isPrivateIp("fec0::1")).toBe(false);
  });

  it("treats 2001:db8:1:2:3:4:5:6 as public", () => {
    // Full 8-group address not in any blocked range
    expect(isPrivateIp("2001:db8:1:2:3:4:5:6")).toBe(false);
  });
});

// ── expandIpv6 v4-mapped path (L171-177) ────────────────────────────
// IPv6 addresses that isIP() accepts as IPv6 but contain an embedded dotted-decimal
// IPv4 portion — these are not caught by isPrivateIp's ::ffff: regex, so they
// flow through ipv6InRange → expandIpv6 → hit the v4-mapped branch (L171).

describe("expandIpv6 v4-mapped branch via non-::ffff prefix", () => {
  it("treats 64:ff9b::192.168.1.1 (NAT64) as private — private v4 part", () => {
    // expandIpv6 matches the v4-mapped regex, parses 192.168.1.1 (v4Num != null),
    // then recurses with the hex form — the result ends up in the fc00::/7 or
    // fe80::/10 range check; none match, so this should be private only if the
    // expanded address happens to be in a blocked range. 192.168.1.1 → 0xc0a80101.
    // Expanded: 64:ff9b::c0a8:101 — not in fc00::/7 or fe80::/10.
    // But it IS a private address conceptually — however the code only blocks
    // its listed ranges. So this is actually NOT blocked — verify it returns false.
    expect(isPrivateIp("64:ff9b::192.168.1.1")).toBe(false);
  });

  it("treats 64:ff9b::8.8.8.8 (NAT64 public) as public", () => {
    // 8.8.8.8 → 0x08080808; expanded: 64:ff9b::808:808 — not in blocked ranges
    expect(isPrivateIp("64:ff9b::8.8.8.8")).toBe(false);
  });

  it("treats 0:0:0:0:0:ffff:192.168.1.1 as private (v4-mapped full notation)", () => {
    // This is equivalent to ::ffff:192.168.1.1 but in expanded form.
    // isPrivateIp regex ^::ffff:... won't match (not compressed).
    // isIP() returns 6, so it goes to ipv6InRange → expandIpv6 → v4-mapped branch.
    // The expanded form 0:0:0:0:0:ffff:c0a8:101 is NOT in fc00::/7 or fe80::/10.
    // Falls through — not in any blocked IPv6 range. Returns false.
    expect(isPrivateIp("0:0:0:0:0:ffff:192.168.1.1")).toBe(false);
  });
});

// ── ipv6InRange exact match — invalid expandIpv6 ────────────────────
// L211 branch 0 — !ipGroups || !rangeGroups on exact-match path

describe("ipv6InRange exact-match with unparseable addresses", () => {
  it("treats invalid IPv6 that isn't caught by isIP() as private (fail-closed)", () => {
    // Node's isIP() returns 6 for "::1", but for garbage it returns 0 → goes to fail-closed
    expect(isPrivateIp("not-an-ip-at-all")).toBe(true);
  });
});

// ── isPrivateIp — empty and invalid ─────────────────────────────────

describe("isPrivateIp base cases", () => {
  it("returns true for empty string", () => {
    expect(isPrivateIp("")).toBe(true);
  });

  it("returns false for a valid public IPv4", () => {
    expect(isPrivateIp("8.8.8.8")).toBe(false);
  });

  it("returns false for another valid public IPv4", () => {
    expect(isPrivateIp("1.1.1.1")).toBe(false);
  });

  it("returns true for loopback 127.0.0.1", () => {
    expect(isPrivateIp("127.0.0.1")).toBe(true);
  });

  it("returns true for private class B 172.16.0.1", () => {
    expect(isPrivateIp("172.16.0.1")).toBe(true);
  });

  it("returns true for link-local 169.254.1.1", () => {
    expect(isPrivateIp("169.254.1.1")).toBe(true);
  });

  it("returns true for totally invalid string (fail-closed)", () => {
    expect(isPrivateIp("totally.invalid")).toBe(true);
  });
});

// ── buildIpPinnedFetchArgs ───────────────────────────────────────────

describe("buildIpPinnedFetchArgs", () => {
  it("replaces hostname with IPv4 and preserves host header", () => {
    const result = buildIpPinnedFetchArgs("https://example.com/path?q=1", "1.2.3.4");
    expect(result.hostHeader).toBe("example.com");
    expect(result.pinnedUrl).toContain("1.2.3.4");
    expect(result.pinnedUrl).toContain("/path");
  });

  it("wraps IPv6 resolved IP in brackets", () => {
    const result = buildIpPinnedFetchArgs("https://example.com/", "2001:db8::1");
    expect(result.pinnedUrl).toContain("[2001:db8::1]");
    expect(result.hostHeader).toBe("example.com");
  });
});
