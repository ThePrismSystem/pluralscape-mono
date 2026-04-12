/**
 * Minimal PK seed fixtures.
 *
 * Mirrors the import-pk test fixture data:
 * - 3 members: Alice (private visibility+pronouns), Bob, Charlie
 * - 2 groups: Group A (Alice + Bob), Group B (Charlie)
 * - 5 switches spanning a week: solo, co-front, solo, empty, solo
 */
import type { EntityFixtures } from "./types.js";

export const MINIMAL_FIXTURES: EntityFixtures = {
  members: [
    {
      ref: "member.alice",
      body: {
        name: "Alice",
        pronouns: "she/her",
        color: "ff6b6b",
        description: "First member in the system",
        avatar_url: "https://example.com/alice.png",
      },
      privacy: {
        visibility: "private",
        pronoun_privacy: "private",
      },
    },
    {
      ref: "member.bob",
      body: {
        name: "Bob",
        pronouns: "he/him",
        color: "4ecdc4",
      },
    },
    {
      ref: "member.charlie",
      body: {
        name: "Charlie",
        pronouns: "they/them",
        description: "Third member",
      },
    },
  ],

  groups: [
    {
      ref: "group.a",
      body: { name: "Group A", description: "Alice and Bob" },
      members: ["member.alice", "member.bob"],
    },
    {
      ref: "group.b",
      body: { name: "Group B" },
      members: ["member.charlie"],
    },
  ],

  switches: [
    { ref: "switch.1", members: ["member.alice"], timestamp: -7 },
    { ref: "switch.2", members: ["member.alice", "member.bob"], timestamp: -5 },
    { ref: "switch.3", members: ["member.bob"], timestamp: -3 },
    { ref: "switch.4", members: [], timestamp: -1 },
    { ref: "switch.5", members: ["member.charlie"], timestamp: 0 },
  ],

  systemPatch: {
    name: "Pluralscape Minimal Test",
    description: "Minimal test system for PK import E2E",
  },
};
