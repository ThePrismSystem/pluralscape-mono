import { describe, expect, it } from "vitest";

import { DEEP_LINK_PREFIXES, NOTIFICATION_ROUTES } from "../linking.js";

describe("DEEP_LINK_PREFIXES", () => {
  it("contains the custom scheme", () => {
    expect(DEEP_LINK_PREFIXES).toContain("pluralscape://");
  });

  it("contains the universal link", () => {
    expect(DEEP_LINK_PREFIXES).toContain("https://app.pluralscape.org");
  });

  it("has exactly 2 entries", () => {
    expect(DEEP_LINK_PREFIXES).toHaveLength(2);
  });
});

describe("NOTIFICATION_ROUTES", () => {
  it("maps friend_request to the social friends route", () => {
    expect(NOTIFICATION_ROUTES["friend_request"]).toBe("/(app)/social/friends");
  });

  it("maps message to the comms chat route", () => {
    expect(NOTIFICATION_ROUTES["message"]).toBe("/(app)/comms/chat");
  });

  it("maps fronting_change to the tabs root", () => {
    expect(NOTIFICATION_ROUTES["fronting_change"]).toBe("/(app)/(tabs)");
  });

  it("all routes start with /(app)", () => {
    for (const route of Object.values(NOTIFICATION_ROUTES)) {
      expect(route).toMatch(/^\/\(app\)/);
    }
  });
});
