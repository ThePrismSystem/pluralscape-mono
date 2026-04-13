import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it, afterEach } from "vitest";

import { createPkFileImportSource } from "../../sources/pk-file-source.js";

import type { PKPayload } from "../../validators/pk-payload.js";
import type { SourceEvent } from "@pluralscape/import-core";

/** Collect all events from an async iterable into an array. */
async function collectEvents(
  source: ReturnType<typeof createPkFileImportSource>,
  collection: string,
): Promise<SourceEvent[]> {
  const events: SourceEvent[] = [];
  for await (const event of source.iterate(collection)) {
    events.push(event);
  }
  return events;
}

function makePayload(overrides?: Partial<PKPayload>): PKPayload {
  return {
    version: 2,
    id: "abcde",
    name: "Test System",
    members: [],
    groups: [],
    switches: [],
    ...overrides,
  };
}

function writeTempFile(payload: PKPayload): { dir: string; filePath: string } {
  const dir = mkdtempSync(join(tmpdir(), "pk-file-source-"));
  const filePath = join(dir, "export.json");
  writeFileSync(filePath, JSON.stringify(payload), "utf-8");
  return { dir, filePath };
}

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs) {
    rmSync(dir, { recursive: true, force: true });
  }
  tempDirs.length = 0;
});

function createTempSource(payload: PKPayload) {
  const { dir, filePath } = writeTempFile(payload);
  tempDirs.push(dir);
  return createPkFileImportSource({ filePath });
}

describe("createPkFileImportSource", () => {
  it("iterates members with correct sourceId", async () => {
    const payload = makePayload({
      members: [
        { id: "m1", name: "Aria", pronouns: "she/her" },
        { id: "m2", name: "Blake", description: "A headmate" },
      ],
    });
    const source = createTempSource(payload);

    const events = await collectEvents(source, "member");

    expect(events).toHaveLength(2);
    expect(events[0]).toMatchObject({ kind: "doc", collection: "member", sourceId: "m1" });
    expect(events[1]).toMatchObject({ kind: "doc", collection: "member", sourceId: "m2" });
  });

  it("iterates groups with correct sourceId", async () => {
    const payload = makePayload({
      groups: [
        { id: "g1", name: "Group A", members: [] },
        { id: "g2", name: "Group B", members: ["m1"] },
      ],
    });
    const source = createTempSource(payload);

    const events = await collectEvents(source, "group");

    expect(events).toHaveLength(2);
    expect(events[0]).toMatchObject({ kind: "doc", collection: "group", sourceId: "g1" });
    expect(events[1]).toMatchObject({ kind: "doc", collection: "group", sourceId: "g2" });
  });

  it("iterates switches with synthetic sourceIds when id is missing", async () => {
    const payload = makePayload({
      switches: [
        { timestamp: "2024-01-01T00:00:00Z", members: ["m1"] },
        { timestamp: "2024-01-02T00:00:00Z", members: ["m2"] },
        { timestamp: "2024-01-03T00:00:00Z", members: ["m1", "m2"] },
      ],
    });
    const source = createTempSource(payload);

    const events = await collectEvents(source, "switch");

    expect(events).toHaveLength(3);
    expect(events[0]).toMatchObject({
      kind: "doc",
      collection: "switch",
      sourceId: "switch-0",
    });
    expect(events[1]).toMatchObject({
      kind: "doc",
      collection: "switch",
      sourceId: "switch-1",
    });
    expect(events[2]).toMatchObject({
      kind: "doc",
      collection: "switch",
      sourceId: "switch-2",
    });
  });

  it("uses real switch id when present", async () => {
    const payload = makePayload({
      switches: [{ id: "sw-real", timestamp: "2024-01-01T00:00:00Z", members: ["m1"] }],
    });
    const source = createTempSource(payload);

    const events = await collectEvents(source, "switch");

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ kind: "doc", sourceId: "sw-real" });
  });

  it("privacy-bucket yields synthetic scan document with member privacy data", async () => {
    const payload = makePayload({
      members: [
        {
          id: "m1",
          name: "Aria",
          privacy: { visibility: "private", name_privacy: "public" },
        },
        {
          id: "m2",
          name: "Blake",
          privacy: { visibility: "public" },
        },
      ],
    });
    const source = createTempSource(payload);

    const events = await collectEvents(source, "privacy-bucket");

    expect(events).toHaveLength(1);
    const event = events[0];
    expect(event).toBeDefined();
    if (event === undefined) throw new Error("unreachable");
    expect(event.kind).toBe("doc");
    expect(event.sourceId).toBe("synthetic:privacy-scan");
    if (event.kind === "doc") {
      const doc = event.document as {
        type: string;
        members: Array<{ pkMemberId: string; privacy?: Record<string, string> }>;
      };
      expect(doc.type).toBe("privacy-scan");
      expect(doc.members).toHaveLength(2);
      expect(doc.members[0]).toMatchObject({
        pkMemberId: "m1",
        privacy: { visibility: "private", name_privacy: "public" },
      });
      expect(doc.members[1]).toMatchObject({
        pkMemberId: "m2",
        privacy: { visibility: "public" },
      });
    }
  });

  it("listCollections returns all 4 collections", async () => {
    const source = createTempSource(makePayload());
    const collections = await source.listCollections();
    expect(collections).toEqual(["member", "group", "switch", "privacy-bucket"]);
  });

  it("empty arrays yield empty iteration", async () => {
    const source = createTempSource(makePayload());

    expect(await collectEvents(source, "member")).toHaveLength(0);
    expect(await collectEvents(source, "group")).toHaveLength(0);
    expect(await collectEvents(source, "switch")).toHaveLength(0);
    // privacy-bucket always yields one synthetic scan document
    const privacyEvents = await collectEvents(source, "privacy-bucket");
    expect(privacyEvents).toHaveLength(1);
    if (privacyEvents[0]?.kind === "doc") {
      const doc = privacyEvents[0].document as { members: unknown[] };
      expect(doc.members).toHaveLength(0);
    }
  });

  it("unknown collection yields nothing", async () => {
    const source = createTempSource(makePayload());
    const events = await collectEvents(source, "nonexistent");
    expect(events).toHaveLength(0);
  });
});
