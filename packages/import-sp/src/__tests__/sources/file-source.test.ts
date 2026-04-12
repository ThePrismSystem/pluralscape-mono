import { describe, expect, it } from "vitest";

import { createFileImportSource, FileSourceParseError } from "../../sources/file-source.js";

import { buildExportJson } from "./file-source.fixtures.js";

import type { SourceEvent } from "../../sources/source.types.js";

/** Wrap a UTF-8 string in a single-chunk ReadableStream. */
function stringToStream(text: string): ReadableStream<Uint8Array> {
  const bytes = new TextEncoder().encode(text);
  return new ReadableStream({
    start(controller) {
      controller.enqueue(bytes);
      controller.close();
    },
  });
}

describe("createFileImportSource", () => {
  it("yields members from a small inline JSON export", async () => {
    const json = buildExportJson({
      members: [
        { _id: "m1", name: "Aria" },
        { _id: "m2", name: "Bryn" },
      ],
    });
    const source = createFileImportSource({ stream: stringToStream(json) });
    const out: string[] = [];
    for await (const e of source.iterate("members")) {
      if (e.kind === "doc") out.push(e.sourceId);
    }
    await source.close();
    expect(out).toEqual(["m1", "m2"]);
  });

  it("yields nothing for a collection not present in the JSON", async () => {
    const json = buildExportJson({ members: [{ _id: "m1", name: "A" }] });
    const source = createFileImportSource({ stream: stringToStream(json) });
    const out: SourceEvent[] = [];
    for await (const e of source.iterate("groups")) {
      out.push(e);
    }
    await source.close();
    expect(out).toHaveLength(0);
  });

  it("preserves nested object fields verbatim", async () => {
    const json = buildExportJson({
      members: [{ _id: "m1", name: "A", info: { fld_1: "v1", fld_2: "v2" } }],
    });
    const source = createFileImportSource({ stream: stringToStream(json) });
    let captured: unknown;
    for await (const e of source.iterate("members")) {
      if (e.kind === "doc") captured = e.document;
    }
    await source.close();
    expect(captured).toEqual({
      _id: "m1",
      name: "A",
      info: { fld_1: "v1", fld_2: "v2" },
    });
  });

  it("handles arrays inside documents (group.members)", async () => {
    const json = buildExportJson({
      groups: [{ _id: "g1", name: "Pod", members: ["m1", "m2", "m3"] }],
    });
    const source = createFileImportSource({ stream: stringToStream(json) });
    let captured: unknown;
    for await (const e of source.iterate("groups")) {
      if (e.kind === "doc") captured = e.document;
    }
    await source.close();
    expect(captured).toEqual({
      _id: "g1",
      name: "Pod",
      members: ["m1", "m2", "m3"],
    });
  });

  it("supports re-iterating the same collection", async () => {
    const json = buildExportJson({ members: [{ _id: "m1", name: "A" }] });
    const source = createFileImportSource({ stream: stringToStream(json) });
    const first: string[] = [];
    for await (const e of source.iterate("members")) {
      if (e.kind === "doc") first.push(e.sourceId);
    }
    const second: string[] = [];
    for await (const e of source.iterate("members")) {
      if (e.kind === "doc") second.push(e.sourceId);
    }
    await source.close();
    expect(first).toEqual(second);
  });

  it("rejects malformed JSON with a FileSourceParseError", async () => {
    const source = createFileImportSource({ stream: stringToStream("{not valid") });
    await expect(async () => {
      for await (const e of source.iterate("members")) {
        void e;
      }
    }).rejects.toBeInstanceOf(FileSourceParseError);
  });

  it("emits drop for documents missing _id and still yields well-formed docs", async () => {
    const json = buildExportJson({ members: [{ name: "no id" }, { _id: "m2", name: "Has id" }] });
    const source = createFileImportSource({ stream: stringToStream(json) });
    const events: SourceEvent[] = [];
    for await (const e of source.iterate("members")) {
      events.push(e);
    }
    await source.close();
    expect(events).toHaveLength(2);
    expect(events[0]?.kind).toBe("drop");
    expect(events[1]?.kind).toBe("doc");
    if (events[1]?.kind === "doc") {
      expect(events[1].sourceId).toBe("m2");
    }
  });

  it("exposes mode 'file'", async () => {
    const source = createFileImportSource({ stream: stringToStream("{}") });
    expect(source.mode).toBe("file");
    await source.close();
  });

  it("listCollections reports every top-level JSON key including unknown ones", async () => {
    const raw = JSON.stringify({
      members: [{ _id: "m1", name: "A" }],
      friends: [{ _id: "f1" }],
      schemaVersion: 2,
    });
    const source = createFileImportSource({ stream: stringToStream(raw) });
    const names = await source.listCollections();
    await source.close();
    expect([...names].sort()).toEqual(["friends", "members", "schemaVersion"]);
  });

  it("listCollections returns empty array for an empty object root", async () => {
    const source = createFileImportSource({ stream: stringToStream("{}") });
    const names = await source.listCollections();
    await source.close();
    expect(names).toEqual([]);
  });

  it("yields drop when a document is not an object", async () => {
    const stream = stringToStream(JSON.stringify({ members: ["not-an-object"] }));
    const source = createFileImportSource({ stream });
    const events: SourceEvent[] = [];
    for await (const e of source.iterate("members")) events.push(e);
    await source.close();
    expect(events).toHaveLength(1);
    expect(events[0]?.kind).toBe("drop");
    if (events[0]?.kind === "drop") {
      expect(events[0].sourceId).toBeNull();
      expect(events[0].reason).toMatch(/not an object/i);
    }
  });

  it("yields drop when a document is missing _id", async () => {
    const stream = stringToStream(JSON.stringify({ members: [{ name: "Alice" }] }));
    const source = createFileImportSource({ stream });
    const events: SourceEvent[] = [];
    for await (const e of source.iterate("members")) events.push(e);
    await source.close();
    expect(events).toHaveLength(1);
    expect(events[0]?.kind).toBe("drop");
    if (events[0]?.kind === "drop") {
      expect(events[0].reason).toMatch(/_id/i);
    }
  });

  it("yields doc events for well-formed documents alongside drops", async () => {
    const stream = stringToStream(
      JSON.stringify({ members: [{ _id: "m1", name: "Alice" }, { name: "Bob" }] }),
    );
    const source = createFileImportSource({ stream });
    const events: SourceEvent[] = [];
    for await (const e of source.iterate("members")) events.push(e);
    await source.close();
    expect(events).toHaveLength(2);
    expect(events[0]?.kind).toBe("doc");
    expect(events[1]?.kind).toBe("drop");
  });

  it("throws FileSourceParseError when root element is an array instead of object", async () => {
    const source = createFileImportSource({ stream: stringToStream("[1, 2, 3]") });
    await expect(async () => {
      for await (const e of source.iterate("members")) {
        void e;
      }
    }).rejects.toThrow(FileSourceParseError);
    await source.close();
  });

  it("throws FileSourceParseError when root element is a scalar (number)", async () => {
    const source = createFileImportSource({ stream: stringToStream("42") });
    await expect(async () => {
      for await (const e of source.iterate("members")) {
        void e;
      }
    }).rejects.toThrow(FileSourceParseError);
    await source.close();
  });

  it("throws FileSourceParseError when root element is a scalar (string)", async () => {
    const source = createFileImportSource({ stream: stringToStream('"hello"') });
    await expect(async () => {
      for await (const e of source.iterate("members")) {
        void e;
      }
    }).rejects.toThrow(FileSourceParseError);
    await source.close();
  });

  it("throws FileSourceParseError when a known SP collection has a non-array value", async () => {
    // `members` is a known SP collection name — if its value is an object
    // instead of an array, the parser should reject it.
    const source = createFileImportSource({
      stream: stringToStream(JSON.stringify({ members: { _id: "m1", name: "Aria" } })),
    });
    await expect(async () => {
      for await (const e of source.iterate("members")) {
        void e;
      }
    }).rejects.toThrow(FileSourceParseError);
    await source.close();
  });
});
