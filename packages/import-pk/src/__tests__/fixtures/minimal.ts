/**
 * Minimal PK import fixture.
 *
 * Mirrors the shape of a real PK export with:
 * - 3 members: Alice (private visibility+pronouns), Bob, Charlie
 * - 2 groups: Group A (Alice + Bob), Group B (Charlie)
 * - 5 switches spanning a week: solo, co-front, solo, empty, solo
 *
 * Each array matches the PK payload shape so the validators/mappers
 * process them identically to real PK data.
 */

// ── Timestamps ──────────────────────────────────────────────────────

export const T1 = "2024-06-01T08:00:00.000Z";
export const T2 = "2024-06-02T10:00:00.000Z";
export const T3 = "2024-06-03T14:00:00.000Z";
export const T4 = "2024-06-05T09:00:00.000Z";
export const T5 = "2024-06-07T18:00:00.000Z";

// ── Members ─────────────────────────────────────────────────────────

export const MEMBERS = [
  {
    id: "alice1",
    name: "Alice",
    pronouns: "she/her",
    color: "ff6b6b",
    avatar_url: "https://example.com/alice.png",
    description: "First member in the system",
    privacy: {
      visibility: "private",
      pronoun_privacy: "private",
    },
  },
  {
    id: "bob02",
    name: "Bob",
    pronouns: "he/him",
    color: "4ecdc4",
    avatar_url: null,
    description: null,
  },
  {
    id: "charl",
    name: "Charlie",
    pronouns: "they/them",
    color: null,
    avatar_url: null,
    description: "Third member",
  },
] as const;

// ── Groups ──────────────────────────────────────────────────────────

export const GROUPS = [
  {
    id: "grp_a",
    name: "Group A",
    description: "Alice and Bob",
    members: ["alice1", "bob02"],
    color: null,
    icon: null,
  },
  {
    id: "grp_b",
    name: "Group B",
    description: null,
    members: ["charl"],
    color: null,
    icon: null,
  },
] as const;

// ── Switches ────────────────────────────────────────────────────────

export const SWITCHES = [
  { id: "sw-1", timestamp: T1, members: ["alice1"] },
  { id: "sw-2", timestamp: T2, members: ["alice1", "bob02"] },
  { id: "sw-3", timestamp: T3, members: ["bob02"] },
  { id: "sw-4", timestamp: T4, members: [] },
  { id: "sw-5", timestamp: T5, members: ["charl"] },
] as const;

// ── Privacy scan data ───────────────────────────────────────────────

export const PRIVACY_SCAN_MEMBERS = [
  {
    pkMemberId: "alice1",
    privacy: { visibility: "private", pronoun_privacy: "private" },
  },
  { pkMemberId: "bob02" },
  { pkMemberId: "charl" },
] as const;

// ── Expected output ─────────────────────────────────────────────────

/**
 * Expected fronting session time ranges derived from the switch sequence.
 *
 * Switch sequence:
 *   T1: [Alice]  ->  T2: [Alice, Bob]  ->  T3: [Bob]  ->  T4: []  ->  T5: [Charlie]
 *
 * Sessions:
 *   Alice: [T1, T3)  — starts at T1, Bob joins at T2, Alice leaves at T3
 *   Bob:   [T2, T4)  — joins at T2, leaves at T4 (empty switch)
 *   Charlie: [T5, null)  — starts at T5, still active
 */
export const EXPECTED_SESSIONS = {
  alice: { startTime: Date.parse(T1), endTime: Date.parse(T3) },
  bob: { startTime: Date.parse(T2), endTime: Date.parse(T4) },
  charlie: { startTime: Date.parse(T5), endTime: null },
} as const;

/** Members expected to land in the "PK Private" bucket. */
export const EXPECTED_PRIVATE_MEMBER_IDS = ["alice1"] as const;
