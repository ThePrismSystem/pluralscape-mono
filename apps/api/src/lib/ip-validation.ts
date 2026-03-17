/** Matches dotted-decimal IPv4 addresses (4 octets of 1-3 digits). */
const IPV4_RE = /^(\d{1,3}\.){3}\d{1,3}$/;

/** Only hex digits, colons, and dots (for IPv4-mapped addresses like ::ffff:192.168.1.1). */
const IPV6_CHAR_RE = /^[\da-f:.]+$/i;

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
