/** Matches dotted-decimal IPv4 addresses (4 octets of 1-3 digits). */
const IPV4_RE = /^(\d{1,3}\.){3}\d{1,3}$/;

/**
 * Lightweight check that a string looks like a valid IP address.
 * Uses format heuristics rather than full RFC validation — the goal is to
 * reject obviously spoofed or garbage X-Forwarded-For values, not to
 * implement a complete IP parser.
 */
export function isValidIpFormat(value: string): boolean {
  if (value.length === 0) return false;
  // All valid IPv6 addresses contain at least one colon
  if (value.includes(":")) return true;
  return IPV4_RE.test(value);
}
