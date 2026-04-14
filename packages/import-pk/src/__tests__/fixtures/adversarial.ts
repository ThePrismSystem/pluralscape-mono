/**
 * Adversarial PK import fixture.
 *
 * Stress-tests the import pipeline with edge cases:
 * - 5 members: unicode names, empty-string name (should be skipped), long descriptions
 * - 3 groups: one empty, one with all members, one referencing a non-existent member
 * - 10 switches: rapid-fire, duplicate timestamps, member reappearance, non-existent ref
 */

// ── Timestamps ──────────────────────────────────────────────────────

export const AT1 = "2024-07-01T00:00:00.000Z";
export const AT2 = "2024-07-01T00:00:00.100Z";
export const AT3 = "2024-07-01T00:00:00.200Z";
export const AT4 = "2024-07-01T00:00:00.200Z"; // duplicate of AT3
export const AT5 = "2024-07-01T00:00:01.000Z";
export const AT6 = "2024-07-01T00:01:00.000Z";
export const AT7 = "2024-07-01T00:02:00.000Z";
export const AT8 = "2024-07-01T00:03:00.000Z";
export const AT9 = "2024-07-01T00:04:00.000Z";
export const AT10 = "2024-07-01T01:00:00.000Z";

// ── Members ─────────────────────────────────────────────────────────

const LONG_DESCRIPTION = "A".repeat(2000);

export const MEMBERS = [
  {
    id: "elise1",
    name: "\u00c9lise",
    pronouns: "elle",
    color: null,
    avatar_url: null,
    description: "Accent in name",
  },
  {
    id: "cjk01",
    name: "\u5149\u306e\u5b50",
    pronouns: null,
    color: "aabbcc",
    avatar_url: null,
    description: LONG_DESCRIPTION,
  },
  {
    id: "empty1",
    name: "",
    pronouns: null,
    color: null,
    avatar_url: null,
    description: "Should be skipped due to empty name",
  },
  {
    id: "sigma1",
    name: "\u03a3\u03b9\u03b3\u03bc\u03b1",
    pronouns: "they/them",
    color: "112233",
    avatar_url: "https://example.com/sigma.png",
    description: null,
  },
  {
    id: "wave01",
    name: "\ud83c\udf0a Wave",
    pronouns: "xe/xem",
    color: null,
    avatar_url: null,
    description: "Emoji in name",
  },
] as const;

// ── Groups ──────────────────────────────────────────────────────────

export const GROUPS = [
  {
    id: "grp_empty",
    name: "Empty Group",
    description: "A group with no members",
    members: [] as readonly string[],
    color: null,
    icon: null,
  },
  {
    id: "grp_all",
    name: "All Members",
    description: null,
    members: ["elise1", "cjk01", "sigma1", "wave01"],
    color: "ff0000",
    icon: null,
  },
  {
    id: "grp_ghost",
    name: "Ghost Ref Group",
    description: "References a non-existent member",
    members: ["elise1", "nonexistent_member_id"],
    color: null,
    icon: null,
  },
] as const;

// ── Switches ────────────────────────────────────────────────────────

export const SWITCHES = [
  { id: "asw-1", timestamp: AT1, members: ["elise1"] },
  { id: "asw-2", timestamp: AT2, members: ["cjk01"] },
  { id: "asw-3", timestamp: AT3, members: ["elise1", "cjk01"] },
  { id: "asw-4", timestamp: AT4, members: ["sigma1"] }, // duplicate timestamp with AT3
  { id: "asw-5", timestamp: AT5, members: ["elise1", "nonexistent_member_id"] },
  { id: "asw-6", timestamp: AT6, members: [] },
  { id: "asw-7", timestamp: AT7, members: ["wave01"] },
  { id: "asw-8", timestamp: AT8, members: ["elise1"] },
  { id: "asw-9", timestamp: AT9, members: ["elise1", "wave01"] }, // reappearance of wave01
  { id: "asw-10", timestamp: AT10, members: ["sigma1"] },
] as const;

// ── Privacy scan data ───────────────────────────────────────────────

export const PRIVACY_SCAN_MEMBERS = [
  { pkMemberId: "elise1", privacy: { visibility: "private" } },
  { pkMemberId: "cjk01" },
  { pkMemberId: "empty1" },
  { pkMemberId: "sigma1" },
  { pkMemberId: "wave01" },
] as const;
