import { describe, expect, it } from "vitest";

import {
  PKGroupSchema,
  PKMemberSchema,
  PKPayloadSchema,
  PKSwitchSchema,
} from "../../validators/pk-payload.js";

describe("PKMemberSchema", () => {
  it("accepts a valid PK file member (minimal)", () => {
    const result = PKMemberSchema.safeParse({ id: "abcde", name: "Aria" });
    expect(result.success).toBe(true);
  });

  it("accepts a valid PK API member with privacy fields", () => {
    const result = PKMemberSchema.safeParse({
      id: "abcde",
      uuid: "123e4567-e89b-12d3-a456-426614174000",
      name: "Aria",
      display_name: "Aria Rose",
      pronouns: "she/her",
      description: "A headmate",
      color: "ff6699",
      avatar_url: "https://example.com/avatar.png",
      created: "2020-01-01T00:00:00Z",
      privacy: {
        visibility: "public",
        name_privacy: "public",
        description_privacy: "private",
        birthday_privacy: "private",
        pronoun_privacy: "public",
        avatar_privacy: "public",
        banner_privacy: "private",
        metadata_privacy: "public",
        proxy_privacy: "public",
      },
      proxy_tags: [{ prefix: "[", suffix: "]" }],
      birthday: "2000-01-15",
      message_count: 42,
    });
    expect(result.success).toBe(true);
  });

  it("rejects a member missing required name", () => {
    const result = PKMemberSchema.safeParse({ id: "abcde" });
    expect(result.success).toBe(false);
  });

  it("rejects a member missing required id", () => {
    const result = PKMemberSchema.safeParse({ name: "Aria" });
    expect(result.success).toBe(false);
  });

  it("rejects a member with empty id", () => {
    const result = PKMemberSchema.safeParse({ id: "", name: "Aria" });
    expect(result.success).toBe(false);
  });

  it("tolerates extra unknown fields (loose object)", () => {
    const result = PKMemberSchema.safeParse({
      id: "abcde",
      name: "Aria",
      __future_field__: "keep me",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect("__future_field__" in result.data).toBe(true);
    }
  });

  it("accepts null/optional string fields", () => {
    const result = PKMemberSchema.safeParse({
      id: "abcde",
      name: "Aria",
      display_name: null,
      pronouns: null,
      description: null,
      color: null,
      avatar_url: null,
      birthday: null,
      banner: null,
      webhook_avatar_url: null,
      last_message_timestamp: null,
    });
    expect(result.success).toBe(true);
  });
});

describe("PKGroupSchema", () => {
  it("accepts a valid group with members array", () => {
    const result = PKGroupSchema.safeParse({
      id: "grp01",
      name: "System Crew",
      members: ["abc01", "abc02"],
    });
    expect(result.success).toBe(true);
  });

  it("accepts a group with no members array, defaulting to empty", () => {
    const result = PKGroupSchema.safeParse({ id: "grp01", name: "Empty Crew" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.members).toEqual([]);
    }
  });

  it("rejects a group missing required name", () => {
    const result = PKGroupSchema.safeParse({ id: "grp01" });
    expect(result.success).toBe(false);
  });

  it("rejects a group missing required id", () => {
    const result = PKGroupSchema.safeParse({ name: "Crew" });
    expect(result.success).toBe(false);
  });

  it("tolerates extra unknown fields (loose object)", () => {
    const result = PKGroupSchema.safeParse({
      id: "grp01",
      name: "Crew",
      __extra__: true,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect("__extra__" in result.data).toBe(true);
    }
  });
});

describe("PKSwitchSchema", () => {
  it("accepts a valid switch with timestamp and members", () => {
    const result = PKSwitchSchema.safeParse({
      id: "sw001",
      timestamp: "2024-01-01T12:00:00Z",
      members: ["abcde", "fghij"],
    });
    expect(result.success).toBe(true);
  });

  it("accepts a switch without optional id", () => {
    const result = PKSwitchSchema.safeParse({
      timestamp: "2024-01-01T12:00:00Z",
      members: ["abcde"],
    });
    expect(result.success).toBe(true);
  });

  it("accepts a switch with empty members array", () => {
    const result = PKSwitchSchema.safeParse({
      timestamp: "2024-01-01T12:00:00Z",
      members: [],
    });
    expect(result.success).toBe(true);
  });

  it("rejects a switch missing timestamp", () => {
    const result = PKSwitchSchema.safeParse({ members: ["abcde"] });
    expect(result.success).toBe(false);
  });

  it("rejects a switch with empty timestamp", () => {
    const result = PKSwitchSchema.safeParse({
      timestamp: "",
      members: ["abcde"],
    });
    expect(result.success).toBe(false);
  });

  it("rejects a switch with non-ISO-8601 timestamp", () => {
    const result = PKSwitchSchema.safeParse({ timestamp: "not-a-date", members: ["abc"] });
    expect(result.success).toBe(false);
  });

  it("accepts a switch with valid ISO-8601 timestamp", () => {
    const result = PKSwitchSchema.safeParse({
      timestamp: "2024-01-01T00:00:00.000Z",
      members: ["abc"],
    });
    expect(result.success).toBe(true);
  });
});

describe("PKPayloadSchema", () => {
  it("accepts a full valid PKImportPayload", () => {
    const result = PKPayloadSchema.safeParse({
      version: 2,
      id: "sys01",
      name: "The Example System",
      members: [
        {
          id: "m0001",
          name: "Aria",
        },
      ],
      groups: [
        {
          id: "g0001",
          name: "Core",
          members: ["m0001"],
        },
      ],
      switches: [
        {
          timestamp: "2024-01-01T12:00:00Z",
          members: ["m0001"],
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("accepts a payload with null system name", () => {
    const result = PKPayloadSchema.safeParse({
      version: 2,
      id: "sys01",
      name: null,
      members: [],
      groups: [],
      switches: [],
    });
    expect(result.success).toBe(true);
  });

  it("rejects a payload missing required system id", () => {
    const result = PKPayloadSchema.safeParse({
      version: 2,
      name: "The System",
      members: [],
      groups: [],
      switches: [],
    });
    expect(result.success).toBe(false);
  });
});

describe("prototype pollution resistance", () => {
  it("does not pollute Object.prototype via __proto__ key in member", () => {
    const payload = JSON.parse(
      '{"version":2,"id":"sys01","members":[{"id":"m1","name":"Evil","__proto__":{"polluted":"yes"}}],"groups":[],"switches":[]}',
    );
    const result = PKPayloadSchema.safeParse(payload);
    // Should parse successfully (looseObject tolerates extra keys)
    expect(result.success).toBe(true);
    // But must NOT pollute Object.prototype
    expect(Object.prototype).not.toHaveProperty("polluted");
  });

  it("does not pollute via constructor key in member", () => {
    const payload = JSON.parse(
      '{"version":2,"id":"sys01","members":[{"id":"m1","name":"Evil","constructor":{"prototype":{"injected":"yes"}}}],"groups":[],"switches":[]}',
    );
    const result = PKPayloadSchema.safeParse(payload);
    expect(result.success).toBe(true);
    expect(Object.prototype).not.toHaveProperty("injected");
  });

  it("does not pollute via __proto__ key in group", () => {
    const payload = JSON.parse(
      '{"version":2,"id":"sys01","members":[],"groups":[{"id":"g1","name":"Bad","__proto__":{"gpolluted":"yes"}}],"switches":[]}',
    );
    const result = PKPayloadSchema.safeParse(payload);
    expect(result.success).toBe(true);
    expect(Object.prototype).not.toHaveProperty("gpolluted");
  });

  it("does not pollute via nested __proto__ in privacy fields", () => {
    const payload = JSON.parse(
      '{"version":2,"id":"sys01","members":[{"id":"m1","name":"Tricky","privacy":{"__proto__":{"deep":"yes"}}}],"groups":[],"switches":[]}',
    );
    // Parse the payload — we only care that it doesn't pollute, not whether
    // the __proto__ key inside privacy passes or fails validation.
    PKPayloadSchema.safeParse(payload);
    // Privacy field has strict enum keys, so __proto__ should either be
    // stripped or ignored by the schema. Either way, no pollution.
    expect(Object.prototype).not.toHaveProperty("deep");
  });
});
