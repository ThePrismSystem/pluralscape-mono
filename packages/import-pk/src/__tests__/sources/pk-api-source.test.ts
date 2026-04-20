import { describe, expect, it, vi, beforeEach } from "vitest";

import { createPkApiImportSource } from "../../sources/pk-api-source.js";

import type { SourceEvent } from "@pluralscape/import-core";

// ── Mock pkapi.js ─────────────────────────────────────────────────────

const mockGetMembers = vi.fn();
const mockGetGroups = vi.fn();
const mockGetSwitches = vi.fn();

vi.mock("pkapi.js", () => {
  function MockPKAPI() {
    return {
      getMembers: mockGetMembers,
      getGroups: mockGetGroups,
      getSwitches: mockGetSwitches,
    };
  }
  return { default: MockPKAPI };
});

// ── Helpers ───────────────────────────────────────────────────────────

async function collectEvents(
  source: ReturnType<typeof createPkApiImportSource>,
  collection: string,
): Promise<SourceEvent[]> {
  const events: SourceEvent[] = [];
  for await (const event of source.iterate(collection)) {
    events.push(event);
  }
  return events;
}

function makeMember(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: "abcde",
    uuid: "00000000-0000-0000-0000-000000000001",
    name: "Test Member",
    display_name: null,
    pronouns: null,
    description: null,
    color: null,
    avatar_url: null,
    created: "2024-01-01T00:00:00.000Z",
    privacy: undefined,
    proxy_tags: [],
    birthday: null,
    banner: null,
    webhook_avatar_url: null,
    keep_proxy: false,
    tts: false,
    autoproxy_enabled: true,
    message_count: 0,
    ...overrides,
  };
}

function makeGroup(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: "grp01",
    uuid: "00000000-0000-0000-0000-000000000002",
    name: "Test Group",
    display_name: null,
    description: null,
    icon: null,
    banner: null,
    color: null,
    members: [],
    privacy: undefined,
    ...overrides,
  };
}

function makeSwitch(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: "sw001",
    timestamp: new Date("2024-01-01T00:00:00.000Z"),
    members: [],
    ...overrides,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
});

describe("createPkApiImportSource", () => {
  it("lists all PK collection names", async () => {
    const source = createPkApiImportSource({ token: "test-token" });
    const collections = await source.listCollections();
    expect(collections).toEqual(["member", "group", "switch", "privacy-bucket"]);
  });

  it("has mode 'api'", () => {
    const source = createPkApiImportSource({ token: "test-token" });
    expect(source.mode).toBe("api");
  });

  describe("baseUrl safety", () => {
    it("allows a default (undefined) baseUrl — pkapi.js applies its own HTTPS default", () => {
      expect(() => createPkApiImportSource({ token: "test-token" })).not.toThrow();
    });

    it("allows an https:// baseUrl", () => {
      expect(() =>
        createPkApiImportSource({ token: "test-token", baseUrl: "https://api.example.com" }),
      ).not.toThrow();
    });

    it("allows http://localhost for local dev against a mock or self-hosted PK", () => {
      expect(() =>
        createPkApiImportSource({ token: "test-token", baseUrl: "http://localhost:8080" }),
      ).not.toThrow();
      expect(() =>
        createPkApiImportSource({ token: "test-token", baseUrl: "http://127.0.0.1:8080" }),
      ).not.toThrow();
    });

    it("rejects http:// baseUrl on a remote host", () => {
      expect(() =>
        createPkApiImportSource({ token: "test-token", baseUrl: "http://api.example.com" }),
      ).toThrow(/refusing to send API token to a non-HTTPS baseUrl/);
    });

    it("rejects non-http(s) protocol schemes", () => {
      expect(() =>
        createPkApiImportSource({ token: "test-token", baseUrl: "ftp://api.example.com" }),
      ).toThrow(/refusing to send API token to a non-HTTPS baseUrl/);
    });

    it("rejects malformed baseUrl strings", () => {
      expect(() => createPkApiImportSource({ token: "test-token", baseUrl: "not a url" })).toThrow(
        /not a valid URL/,
      );
    });
  });

  describe("token safety", () => {
    it("rejects an empty-string token", () => {
      expect(() => createPkApiImportSource({ token: "" })).toThrow(
        /token must be a non-empty string/,
      );
    });

    it("rejects a whitespace-only token", () => {
      expect(() => createPkApiImportSource({ token: "   " })).toThrow(
        /token must be a non-empty string/,
      );
    });
  });

  describe("member iteration", () => {
    it("yields doc events for each member", async () => {
      const membersMap = new Map([["abcde", makeMember()]]);
      mockGetMembers.mockResolvedValueOnce(membersMap);

      const source = createPkApiImportSource({ token: "test-token" });
      const events = await collectEvents(source, "member");

      expect(events).toHaveLength(1);
      expect(events[0]?.kind).toBe("doc");
      if (events[0]?.kind === "doc") {
        expect(events[0].sourceId).toBe("abcde");
        expect((events[0].document as Record<string, unknown>)["name"]).toBe("Test Member");
      }
    });

    it("collects privacy data for the privacy-bucket pass", async () => {
      const membersMap = new Map([
        ["m1", makeMember({ id: "m1", privacy: { visibility: "private" } })],
        ["m2", makeMember({ id: "m2", privacy: undefined })],
      ]);
      mockGetMembers.mockResolvedValueOnce(membersMap);

      const source = createPkApiImportSource({ token: "test-token" });
      await collectEvents(source, "member");

      // Privacy-bucket pass should yield a scan document with collected privacy data
      const bucketEvents = await collectEvents(source, "privacy-bucket");
      expect(bucketEvents).toHaveLength(1);
      if (bucketEvents[0]?.kind === "doc") {
        const doc = bucketEvents[0].document as { members: readonly { pkMemberId: string }[] };
        expect(doc.members).toHaveLength(2);
        expect(doc.members[0]?.pkMemberId).toBe("m1");
      }
    });

    it("maps birthday string correctly", async () => {
      const membersMap = new Map([["m1", makeMember({ id: "m1", birthday: "2000-01-15" })]]);
      mockGetMembers.mockResolvedValueOnce(membersMap);

      const source = createPkApiImportSource({ token: "test-token" });
      const events = await collectEvents(source, "member");

      if (events[0]?.kind === "doc") {
        expect((events[0].document as Record<string, unknown>)["birthday"]).toBe("2000-01-15");
      }
    });

    it("maps non-string birthday to null", async () => {
      const membersMap = new Map([["m1", makeMember({ id: "m1", birthday: 12345 })]]);
      mockGetMembers.mockResolvedValueOnce(membersMap);

      const source = createPkApiImportSource({ token: "test-token" });
      const events = await collectEvents(source, "member");

      if (events[0]?.kind === "doc") {
        expect((events[0].document as Record<string, unknown>)["birthday"]).toBeNull();
      }
    });

    it("maps Date created field to undefined", async () => {
      const membersMap = new Map([
        ["m1", makeMember({ id: "m1", created: new Date("2024-01-01") })],
      ]);
      mockGetMembers.mockResolvedValueOnce(membersMap);

      const source = createPkApiImportSource({ token: "test-token" });
      const events = await collectEvents(source, "member");

      if (events[0]?.kind === "doc") {
        expect((events[0].document as Record<string, unknown>)["created"]).toBeUndefined();
      }
    });
  });

  describe("group iteration", () => {
    it("yields doc events for each group", async () => {
      const groupsMap = new Map([["grp01", makeGroup()]]);
      mockGetGroups.mockResolvedValueOnce(groupsMap);

      const source = createPkApiImportSource({ token: "test-token" });
      const events = await collectEvents(source, "group");

      expect(events).toHaveLength(1);
      expect(events[0]?.kind).toBe("doc");
      if (events[0]?.kind === "doc") {
        expect(events[0].sourceId).toBe("grp01");
        expect((events[0].document as Record<string, unknown>)["name"]).toBe("Test Group");
      }
    });

    it("extracts member IDs from Map", async () => {
      const membersMap = new Map([
        ["m1", {}],
        ["m2", {}],
      ]);
      const groupsMap = new Map([["grp01", makeGroup({ members: membersMap })]]);
      mockGetGroups.mockResolvedValueOnce(groupsMap);

      const source = createPkApiImportSource({ token: "test-token" });
      const events = await collectEvents(source, "group");

      if (events[0]?.kind === "doc") {
        expect((events[0].document as Record<string, unknown>)["members"]).toEqual(["m1", "m2"]);
      }
    });

    it("extracts member IDs from array", async () => {
      const groupsMap = new Map([["grp01", makeGroup({ members: ["m1", "m2"] })]]);
      mockGetGroups.mockResolvedValueOnce(groupsMap);

      const source = createPkApiImportSource({ token: "test-token" });
      const events = await collectEvents(source, "group");

      if (events[0]?.kind === "doc") {
        expect((events[0].document as Record<string, unknown>)["members"]).toEqual(["m1", "m2"]);
      }
    });
  });

  describe("switch iteration", () => {
    it("yields doc events for switches from a Map result", async () => {
      const switchesMap = new Map([["sw001", makeSwitch({ id: "sw001", members: ["m1"] })]]);
      mockGetSwitches.mockResolvedValueOnce(switchesMap);

      const source = createPkApiImportSource({ token: "test-token" });
      const events = await collectEvents(source, "switch");

      expect(events).toHaveLength(1);
      expect(events[0]?.kind).toBe("doc");
      if (events[0]?.kind === "doc") {
        expect(events[0].sourceId).toBe("sw001");
      }
    });

    it("extracts ISO timestamp from Date object", async () => {
      const date = new Date("2024-06-15T12:00:00.000Z");
      const switchesMap = new Map([["sw001", makeSwitch({ id: "sw001", timestamp: date })]]);
      mockGetSwitches.mockResolvedValueOnce(switchesMap);

      const source = createPkApiImportSource({ token: "test-token" });
      const events = await collectEvents(source, "switch");

      if (events[0]?.kind === "doc") {
        const doc = events[0].document as Record<string, unknown>;
        expect(doc["timestamp"]).toBe("2024-06-15T12:00:00.000Z");
      }
    });

    it("passes through string timestamp", async () => {
      const switchesMap = new Map([
        ["sw001", makeSwitch({ id: "sw001", timestamp: "2024-06-15T12:00:00.000Z" })],
      ]);
      mockGetSwitches.mockResolvedValueOnce(switchesMap);

      const source = createPkApiImportSource({ token: "test-token" });
      const events = await collectEvents(source, "switch");

      if (events[0]?.kind === "doc") {
        const doc = events[0].document as Record<string, unknown>;
        expect(doc["timestamp"]).toBe("2024-06-15T12:00:00.000Z");
      }
    });

    it("yields drop event when getSwitches returns non-Map", async () => {
      mockGetSwitches.mockResolvedValueOnce([]);

      const source = createPkApiImportSource({ token: "test-token" });
      const events = await collectEvents(source, "switch");

      expect(events).toHaveLength(1);
      expect(events[0]?.kind).toBe("drop");
      if (events[0]?.kind === "drop") {
        expect(events[0].reason).toContain("instead of Map");
      }
    });

    it("uses index-based sourceId when switch has no id", async () => {
      const switchesMap = new Map([["", makeSwitch({ id: "", members: [] })]]);
      mockGetSwitches.mockResolvedValueOnce(switchesMap);

      const source = createPkApiImportSource({ token: "test-token" });
      const events = await collectEvents(source, "switch");

      if (events[0]?.kind === "doc") {
        expect(events[0].sourceId).toBe("switch-0");
      }
    });
  });

  describe("privacy-bucket iteration", () => {
    it("yields synthetic privacy-scan document", async () => {
      mockGetMembers.mockResolvedValueOnce(new Map());

      const source = createPkApiImportSource({ token: "test-token" });
      // Must iterate members first to collect privacy data
      await collectEvents(source, "member");
      const events = await collectEvents(source, "privacy-bucket");

      expect(events).toHaveLength(1);
      if (events[0]?.kind === "doc") {
        expect(events[0].sourceId).toBe("synthetic:privacy-scan");
        const doc = events[0].document as { type: string };
        expect(doc.type).toBe("privacy-scan");
      }
    });
  });

  describe("unknown collection", () => {
    it("yields nothing for unknown collection names", async () => {
      const source = createPkApiImportSource({ token: "test-token" });
      const events = await collectEvents(source, "unknown-collection");
      expect(events).toHaveLength(0);
    });
  });

  describe("close", () => {
    it("clears collected member privacy data", async () => {
      const membersMap = new Map([["m1", makeMember({ id: "m1" })]]);
      mockGetMembers.mockResolvedValue(membersMap);

      const source = createPkApiImportSource({ token: "test-token" });
      await collectEvents(source, "member");
      await source.close();

      // After close, privacy-bucket pass should yield empty members array
      const events = await collectEvents(source, "privacy-bucket");
      if (events[0]?.kind === "doc") {
        const doc = events[0].document as { members: readonly unknown[] };
        expect(doc.members).toHaveLength(0);
      }
    });
  });
});
