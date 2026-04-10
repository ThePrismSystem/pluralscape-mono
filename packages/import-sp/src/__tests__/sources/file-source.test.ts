import { describe, expect, it } from "vitest";

import { createFileImportSource, FileSourceParseError } from "../../sources/file-source.js";

import { buildExportJson } from "./file-source.fixtures.js";

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
    for await (const doc of source.iterate("members")) {
      out.push(doc.sourceId);
    }
    await source.close();
    expect(out).toEqual(["m1", "m2"]);
  });

  it("yields nothing for a collection not present in the JSON", async () => {
    const json = buildExportJson({ members: [{ _id: "m1", name: "A" }] });
    const source = createFileImportSource({ stream: stringToStream(json) });
    const out: unknown[] = [];
    for await (const doc of source.iterate("groups")) {
      out.push(doc);
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
    for await (const doc of source.iterate("members")) {
      captured = doc.document;
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
    for await (const doc of source.iterate("groups")) {
      captured = doc.document;
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
    for await (const d of source.iterate("members")) {
      first.push(d.sourceId);
    }
    const second: string[] = [];
    for await (const d of source.iterate("members")) {
      second.push(d.sourceId);
    }
    await source.close();
    expect(first).toEqual(second);
  });

  it("rejects malformed JSON with a FileSourceParseError", async () => {
    const source = createFileImportSource({ stream: stringToStream("{not valid") });
    await expect(async () => {
      for await (const doc of source.iterate("members")) {
        void doc;
      }
    }).rejects.toBeInstanceOf(FileSourceParseError);
  });

  it("skips documents missing _id during iteration", async () => {
    const json = buildExportJson({ members: [{ name: "no id" }, { _id: "m2", name: "Has id" }] });
    const source = createFileImportSource({ stream: stringToStream(json) });
    const out: string[] = [];
    for await (const doc of source.iterate("members")) {
      out.push(doc.sourceId);
    }
    await source.close();
    expect(out).toEqual(["m2"]);
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
});
