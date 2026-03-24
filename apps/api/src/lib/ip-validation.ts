import { resolve4, resolve6 } from "node:dns/promises";
import { isIP } from "node:net";

/** Matches dotted-decimal IPv4 addresses (4 octets of 1-3 digits). */
const IPV4_RE = /^(\d{1,3}\.){3}\d{1,3}$/;

/** Only hex digits, colons, and dots (for IPv4-mapped addresses like ::ffff:192.168.1.1). */
const IPV6_CHAR_RE = /^[\da-f:.]+$/i;

// ── Blocked IPv4 CIDR ranges ────────────────────────────────────────

/** IPv4 loopback range (127.0.0.0/8). */
export const IPV4_LOOPBACK = "127.0.0.0/8";

/** IPv4 Class A private range (10.0.0.0/8). */
export const IPV4_PRIVATE_A = "10.0.0.0/8";

/** IPv4 Class B private range (172.16.0.0/12). */
export const IPV4_PRIVATE_B = "172.16.0.0/12";

/** IPv4 Class C private range (192.168.0.0/16). */
export const IPV4_PRIVATE_C = "192.168.0.0/16";

/** IPv4 link-local range (169.254.0.0/16). */
export const IPV4_LINK_LOCAL = "169.254.0.0/16";

/** IPv4 "this network" range (0.0.0.0/8). */
export const IPV4_THIS_NETWORK = "0.0.0.0/8";

/** Carrier-Grade NAT range (100.64.0.0/10, RFC 6598). */
export const IPV4_CGNAT = "100.64.0.0/10";

/** Benchmarking range (198.18.0.0/15, RFC 2544). */
export const IPV4_BENCHMARKING = "198.18.0.0/15";

/** IETF protocol assignments (192.0.0.0/24, RFC 6890). */
export const IPV4_IETF_PROTOCOL = "192.0.0.0/24";

/** TEST-NET-1 documentation range (192.0.2.0/24, RFC 5737). */
export const IPV4_TEST_NET_1 = "192.0.2.0/24";

/** TEST-NET-2 documentation range (198.51.100.0/24, RFC 5737). */
export const IPV4_TEST_NET_2 = "198.51.100.0/24";

/** TEST-NET-3 documentation range (203.0.113.0/24, RFC 5737). */
export const IPV4_TEST_NET_3 = "203.0.113.0/24";

/** Reserved for future use (240.0.0.0/4). */
export const IPV4_RESERVED = "240.0.0.0/4";

/** Limited broadcast address (255.255.255.255/32). */
export const IPV4_BROADCAST = "255.255.255.255/32";

/** All blocked IPv4 CIDR ranges for SSRF protection. */
export const BLOCKED_IPV4_RANGES = [
  IPV4_LOOPBACK,
  IPV4_PRIVATE_A,
  IPV4_PRIVATE_B,
  IPV4_PRIVATE_C,
  IPV4_LINK_LOCAL,
  IPV4_THIS_NETWORK,
  IPV4_CGNAT,
  IPV4_BENCHMARKING,
  IPV4_IETF_PROTOCOL,
  IPV4_TEST_NET_1,
  IPV4_TEST_NET_2,
  IPV4_TEST_NET_3,
  IPV4_RESERVED,
  IPV4_BROADCAST,
] as const;

// ── Blocked IPv6 addresses and ranges ───────────────────────────────

/** IPv6 loopback address. */
export const IPV6_LOOPBACK = "::1";

/** IPv6 unique local address range (fc00::/7). */
export const IPV6_UNIQUE_LOCAL = "fc00::/7";

/** IPv6 link-local range (fe80::/10). */
export const IPV6_LINK_LOCAL = "fe80::/10";

/** IPv6 unspecified address. */
export const IPV6_UNSPECIFIED = "::";

/** All blocked IPv6 addresses and CIDR ranges for SSRF protection. */
export const BLOCKED_IPV6_RANGES = [
  IPV6_LOOPBACK,
  IPV6_UNIQUE_LOCAL,
  IPV6_LINK_LOCAL,
  IPV6_UNSPECIFIED,
] as const;

// ── IP parsing constants ──────────────────────────────────────────────

/** Number of octets in an IPv4 address. */
const IPV4_OCTET_COUNT = 4;

/** Maximum value of an IPv4 octet. */
const IPV4_MAX_OCTET = 255;

/** Number of bits in an IPv4 octet (used for bit-shifting). */
const IPV4_OCTET_BITS = 8;

/** Total bits in an IPv4 address. */
const IPV4_TOTAL_BITS = 32;

/** Number of 16-bit groups in an IPv6 address. */
const IPV6_GROUP_COUNT = 8;

/** Bits per IPv6 group. */
const IPV6_GROUP_BITS = 16;

/** Bitmask for a 16-bit group. */
const IPV6_GROUP_MASK = 0xffff;

/** Radix for parsing and formatting hexadecimal strings (base 16). */
const HEX_RADIX = 16;

/** Version number returned by `isIP()` for IPv4. */
const IP_VERSION_4 = 4;

/** Version number returned by `isIP()` for IPv6. */
const IP_VERSION_6 = 6;

// ── Helpers ─────────────────────────────────────────────────────────

/**
 * Parse an IPv4 address string into a 32-bit numeric value.
 * Returns null if the address is not a valid IPv4 address.
 */
function parseIpv4ToNumber(ip: string): number | null {
  const parts = ip.split(".");
  if (parts.length !== IPV4_OCTET_COUNT) return null;

  let result = 0;
  for (const part of parts) {
    const octet = Number(part);
    if (!Number.isInteger(octet) || octet < 0 || octet > IPV4_MAX_OCTET) return null;
    result = (result << IPV4_OCTET_BITS) | octet;
  }
  // Convert to unsigned 32-bit integer
  return result >>> 0;
}

/**
 * Check whether an IPv4 address falls within a CIDR range.
 */
function ipv4InCidr(ip: string, cidr: string): boolean {
  const [rangeIp, prefixStr] = cidr.split("/");
  if (!rangeIp || !prefixStr) return false;

  const ipNum = parseIpv4ToNumber(ip);
  const rangeNum = parseIpv4ToNumber(rangeIp);
  if (ipNum === null || rangeNum === null) return false;

  const prefix = Number(prefixStr);
  if (prefix === 0) return true;

  const mask = (~0 << (IPV4_TOTAL_BITS - prefix)) >>> 0;
  return (ipNum & mask) === (rangeNum & mask);
}

/**
 * Expand an IPv6 address to its full 8-group representation.
 * Returns null if the address is not a valid IPv6 address.
 */
function expandIpv6(ip: string): number[] | null {
  // Handle IPv4-mapped IPv6 (::ffff:1.2.3.4)
  const v4MappedMatch = /^(.*):(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/.exec(ip);
  if (v4MappedMatch) {
    const v4Num = parseIpv4ToNumber(v4MappedMatch[2] ?? "");
    if (v4Num === null) return null;
    const v6Prefix = v4MappedMatch[1] ?? "";
    const highWord = (v4Num >>> IPV6_GROUP_BITS) & IPV6_GROUP_MASK;
    const lowWord = v4Num & IPV6_GROUP_MASK;
    return expandIpv6(`${v6Prefix}:${highWord.toString(HEX_RADIX)}:${lowWord.toString(HEX_RADIX)}`);
  }

  const halves = ip.split("::");
  if (halves.length > 2) return null;

  const parseGroups = (s: string): number[] => {
    if (s === "") return [];
    return s.split(":").map((g) => parseInt(g, HEX_RADIX));
  };

  if (halves.length === 2) {
    const left = parseGroups(halves[0] ?? "");
    const right = parseGroups(halves[1] ?? "");
    const missing = IPV6_GROUP_COUNT - left.length - right.length;
    if (missing < 0) return null;
    const groups = [...left, ...(Array(missing).fill(0) as number[]), ...right];
    if (groups.length !== IPV6_GROUP_COUNT) return null;
    return groups;
  }

  const groups = parseGroups(ip);
  if (groups.length !== IPV6_GROUP_COUNT) return null;
  return groups;
}

/**
 * Check whether an IPv6 address falls within a CIDR range or matches exactly.
 */
function ipv6InRange(ip: string, range: string): boolean {
  // Exact match (e.g., "::1" or "::")
  if (!range.includes("/")) {
    const ipGroups = expandIpv6(ip);
    const rangeGroups = expandIpv6(range);
    if (!ipGroups || !rangeGroups) return false;
    return ipGroups.every((g, i) => g === rangeGroups[i]);
  }

  const [rangeAddr, prefixStr] = range.split("/");
  if (!rangeAddr || !prefixStr) return false;

  const ipGroups = expandIpv6(ip);
  const rangeGroups = expandIpv6(rangeAddr);
  if (!ipGroups || !rangeGroups) return false;

  const prefix = Number(prefixStr);

  // Check each 16-bit group
  let bitsRemaining = prefix;
  for (let i = 0; i < IPV6_GROUP_COUNT; i++) {
    if (bitsRemaining <= 0) break;

    const ipGroup = ipGroups[i] ?? 0;
    const rangeGroup = rangeGroups[i] ?? 0;

    if (bitsRemaining >= IPV6_GROUP_BITS) {
      if (ipGroup !== rangeGroup) return false;
      bitsRemaining -= IPV6_GROUP_BITS;
    } else {
      const mask = (IPV6_GROUP_MASK << (IPV6_GROUP_BITS - bitsRemaining)) & IPV6_GROUP_MASK;
      if ((ipGroup & mask) !== (rangeGroup & mask)) return false;
      bitsRemaining = 0;
    }
  }
  return true;
}

// ── Exported functions ──────────────────────────────────────────────

/**
 * Lightweight check that a string looks like a valid IP address.
 * Uses format heuristics rather than full RFC validation — the goal is to
 * reject obviously spoofed or garbage X-Forwarded-For values, not to
 * implement a complete IP parser.
 */
export function isValidIpFormat(value: string): boolean {
  if (value.length === 0) return false;
  // All valid IPv6 addresses contain at least one colon
  if (value.includes(":")) return IPV6_CHAR_RE.test(value);
  return IPV4_RE.test(value);
}

/**
 * Check whether an IP address falls within any private or reserved range.
 *
 * Returns true for:
 * - IPv4: 127.0.0.0/8, 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16, 169.254.0.0/16, 0.0.0.0/8
 * - IPv6: ::1, fc00::/7, fe80::/10, ::
 * - IPv4-mapped IPv6 (e.g., ::ffff:127.0.0.1)
 *
 * Returns false for public IPs. Returns true for empty strings or invalid formats
 * (fail-closed: unrecognized addresses are treated as private).
 */
export function isPrivateIp(ip: string): boolean {
  if (ip.length === 0) return true;

  const ipVersion = isIP(ip);

  if (ipVersion === IP_VERSION_4) {
    return BLOCKED_IPV4_RANGES.some((cidr) => ipv4InCidr(ip, cidr));
  }

  if (ipVersion === IP_VERSION_6) {
    // Check for IPv4-mapped IPv6 addresses (::ffff:x.x.x.x)
    const v4MappedMatch = /^::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/i.exec(ip);
    if (v4MappedMatch) {
      const v4Addr = v4MappedMatch[1] ?? "";
      return BLOCKED_IPV4_RANGES.some((cidr) => ipv4InCidr(v4Addr, cidr));
    }

    return BLOCKED_IPV6_RANGES.some((range) => ipv6InRange(ip, range));
  }

  // Not a valid IP — fail closed
  return true;
}

/**
 * Resolve a URL's hostname via DNS and validate that all resolved IPs
 * are public (not private/reserved).
 *
 * Always runs DNS resolution and IP validation regardless of NODE_ENV.
 * Callers are responsible for HTTPS enforcement and logging.
 *
 * @returns Array of resolved IP addresses (all validated as public).
 * @throws Error if the URL is invalid, hostname cannot be resolved,
 *   or any resolved IP falls within a private/reserved range.
 *
 * **DNS rebinding (TOCTOU):** This pre-flight check resolves DNS
 * independently from a subsequent `fetch()`. A sophisticated attacker
 * could return a public IP here then rebind to a private IP before the
 * HTTP connection is established. This is an accepted limitation —
 * standard `fetch()` does not expose the resolved IP or support
 * connecting to a specific address. The config-time URL validation is
 * the primary defense; the delivery-time check is defense-in-depth
 * against DNS changes between config creation and delivery.
 */
export async function resolveAndValidateUrl(url: string): Promise<string[]> {
  let hostname: string;
  try {
    hostname = new URL(url).hostname;
  } catch {
    throw new Error("Webhook URL is not a valid URL");
  }

  const [v4Result, v6Result] = await Promise.allSettled([resolve4(hostname), resolve6(hostname)]);

  const resolvedIps: string[] = [];
  if (v4Result.status === "fulfilled") {
    resolvedIps.push(...v4Result.value);
  }
  if (v6Result.status === "fulfilled") {
    resolvedIps.push(...v6Result.value);
  }

  if (resolvedIps.length === 0) {
    throw new Error("Webhook URL hostname could not be resolved");
  }

  for (const ip of resolvedIps) {
    if (isPrivateIp(ip)) {
      throw new Error("Webhook URL must not resolve to a private or reserved IP address");
    }
  }

  return resolvedIps;
}
