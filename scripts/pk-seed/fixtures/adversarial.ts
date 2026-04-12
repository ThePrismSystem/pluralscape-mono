/**
 * Adversarial PK seed fixtures.
 *
 * Stress-tests the import pipeline with edge cases:
 * - 5 members: unicode names, long descriptions, emoji in name
 * - 3 groups: one empty, one with all members, one referencing a non-existent member (excluded from seed)
 * - 10 switches: rapid-fire, co-fronts, empty switch, member reappearance
 *
 * Note: The adversarial import-pk test fixture includes a member with an
 * empty-string name and a group referencing a non-existent member. The seed
 * script cannot create these via the API (PK validates names and member refs),
 * so they are intentionally omitted here. The import tests use static fixtures
 * to cover those edge cases instead.
 */
import type { EntityFixtures } from "./types.js";

const LONG_DESCRIPTION = "A".repeat(2000);

export const ADVERSARIAL_FIXTURES: EntityFixtures = {
  members: [
    {
      ref: "member.elise",
      body: {
        name: "\u00C9lise",
        pronouns: "elle",
        description: "Accent in name",
      },
    },
    {
      ref: "member.cjk",
      body: {
        name: "\u5149\u306E\u5B50",
        color: "aabbcc",
        description: LONG_DESCRIPTION,
      },
    },
    {
      ref: "member.sigma",
      body: {
        name: "\u03A3\u03B9\u03B3\u03BC\u03B1",
        pronouns: "they/them",
        color: "112233",
        avatar_url: "https://example.com/sigma.png",
      },
    },
    {
      ref: "member.wave",
      body: {
        name: "\uD83C\uDF0A Wave",
        pronouns: "xe/xem",
        description: "Emoji in name",
      },
    },
    {
      ref: "member.zws",
      body: {
        name: "ZWS\u200BTest",
        description: "Zero-width space in name",
      },
    },
  ],

  groups: [
    {
      ref: "group.empty",
      body: { name: "Empty Group", description: "A group with no members" },
      members: [],
    },
    {
      ref: "group.all",
      body: { name: "All Members", color: "ff0000" },
      members: ["member.elise", "member.cjk", "member.sigma", "member.wave", "member.zws"],
    },
  ],

  switches: [
    { ref: "switch.1", members: ["member.elise"], timestamp: -7 },
    { ref: "switch.2", members: ["member.cjk"], timestamp: -6 },
    { ref: "switch.3", members: ["member.elise", "member.cjk"], timestamp: -5 },
    { ref: "switch.4", members: ["member.sigma"], timestamp: -4 },
    { ref: "switch.5", members: ["member.elise"], timestamp: -3 },
    { ref: "switch.6", members: [], timestamp: -2 },
    { ref: "switch.7", members: ["member.wave"], timestamp: -1 },
    { ref: "switch.8", members: ["member.elise"], timestamp: "2024-07-01T00:03:00.000Z" },
    {
      ref: "switch.9",
      members: ["member.elise", "member.wave"],
      timestamp: "2024-07-01T00:04:00.000Z",
    },
    { ref: "switch.10", members: ["member.sigma"], timestamp: 0 },
  ],

  systemPatch: {
    name: "\uD83C\uDF08 Adversarial Test \u6D4B\u8BD5",
    description: "Adversarial test system with unicode edge cases",
    color: "ff00ff",
  },
};
