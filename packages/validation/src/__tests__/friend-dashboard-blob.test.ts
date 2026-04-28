import { describe, expect, test } from "vitest";

import {
  FriendDashboardCustomFrontBlobSchema,
  FriendDashboardFrontingSessionBlobSchema,
  FriendDashboardMemberBlobSchema,
  FriendDashboardStructureEntityBlobSchema,
} from "../friend-dashboard-blob.js";

describe("FriendDashboardMemberBlobSchema", () => {
  test("parses a complete member blob", () => {
    const input = {
      name: "Alex",
      pronouns: ["they/them"],
      description: "Lead member",
      colors: ["#ff0000"],
    };
    expect(FriendDashboardMemberBlobSchema.parse(input)).toEqual(input);
  });

  test("requires name", () => {
    expect(() => FriendDashboardMemberBlobSchema.parse({ pronouns: ["they/them"] })).toThrow();
  });

  test("allows null description and missing optional fields", () => {
    const input = { name: "Alex", description: null };
    const parsed = FriendDashboardMemberBlobSchema.parse(input);
    expect(parsed.name).toBe("Alex");
    expect(parsed.description).toBeNull();
  });

  test("allows null entries inside the colors array", () => {
    const input = { name: "Alex", colors: ["#abcdef", null] };
    const parsed = FriendDashboardMemberBlobSchema.parse(input);
    expect(parsed.colors).toEqual(["#abcdef", null]);
  });
});

describe("FriendDashboardFrontingSessionBlobSchema", () => {
  test("accepts an empty object (all fields optional)", () => {
    expect(FriendDashboardFrontingSessionBlobSchema.parse({})).toEqual({});
  });

  test("parses comment, positionality, outtrigger fields", () => {
    const input = {
      comment: "comment text",
      positionality: "back",
      outtrigger: null,
      outtriggerSentiment: "positive",
    };
    expect(FriendDashboardFrontingSessionBlobSchema.parse(input)).toEqual(input);
  });

  test("rejects unknown outtriggerSentiment values", () => {
    expect(() =>
      FriendDashboardFrontingSessionBlobSchema.parse({ outtriggerSentiment: "ambivalent" }),
    ).toThrow();
  });
});

describe("FriendDashboardCustomFrontBlobSchema", () => {
  test("requires name", () => {
    expect(() => FriendDashboardCustomFrontBlobSchema.parse({ description: "x" })).toThrow();
  });

  test("parses all optional fields", () => {
    const input = {
      name: "Sleep",
      description: "Nighttime state",
      color: "#102030",
      emoji: "💤",
    };
    expect(FriendDashboardCustomFrontBlobSchema.parse(input)).toEqual(input);
  });
});

describe("FriendDashboardStructureEntityBlobSchema", () => {
  test("requires name", () => {
    expect(() => FriendDashboardStructureEntityBlobSchema.parse({ description: "x" })).toThrow();
  });

  test("parses imageSource discriminated union", () => {
    const input = {
      name: "Inner garden",
      imageSource: { kind: "external", url: "https://example.com/garden.png" },
    };
    const parsed = FriendDashboardStructureEntityBlobSchema.parse(input);
    expect(parsed.imageSource).toEqual({
      kind: "external",
      url: "https://example.com/garden.png",
    });
  });
});
