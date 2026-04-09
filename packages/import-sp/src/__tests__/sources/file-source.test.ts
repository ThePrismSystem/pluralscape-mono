import { describe, expect, it } from "vitest";

import { createFileImportSource } from "../../sources/file-source.js";

import { buildExportJson, bytes } from "./file-source.fixtures.js";

describe("createFileImportSource", () => {
  it("yields members from a small inline JSON export", async () => {
    const json = buildExportJson({
      members: [
        { _id: "m1", name: "Aria" },
        { _id: "m2", name: "Bryn" },
      ],
    });
    const source = await createFileImportSource({ jsonBytes: bytes(json) });
    const out: string[] = [];
    for await (const doc of source.iterate("members")) {
      out.push(doc.sourceId);
    }
    await source.close();
    expect(out).toEqual(["m1", "m2"]);
  });

  it("yields nothing for a collection not present in the JSON", async () => {
    const json = buildExportJson({ members: [{ _id: "m1", name: "A" }] });
    const source = await createFileImportSource({ jsonBytes: bytes(json) });
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
    const source = await createFileImportSource({ jsonBytes: bytes(json) });
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
    const source = await createFileImportSource({ jsonBytes: bytes(json) });
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
    const source = await createFileImportSource({ jsonBytes: bytes(json) });
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

  it("rejects malformed JSON with a fatal-class error", async () => {
    let caught: unknown;
    try {
      await createFileImportSource({ jsonBytes: bytes("{not valid") });
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(Error);
  });

  it("rejects a document missing _id", async () => {
    const json = buildExportJson({ members: [{ name: "no id" }] });
    let caught: unknown;
    try {
      await createFileImportSource({ jsonBytes: bytes(json) });
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(Error);
    if (caught instanceof Error) {
      expect(caught.message).toContain("_id");
    }
  });

  it("exposes mode 'file'", async () => {
    const source = await createFileImportSource({ jsonBytes: bytes("{}") });
    expect(source.mode).toBe("file");
    await source.close();
  });

  it("listCollections reports every top-level JSON key including unknown ones", async () => {
    // Build a JSON with one supported SP collection plus an unknown top-level
    // key ("friends"). The engine uses the unknown key to emit a
    // `dropped-collection` warning, so the source must surface it here.
    const raw = JSON.stringify({
      members: [{ _id: "m1", name: "A" }],
      friends: [{ _id: "f1" }],
      schemaVersion: 2,
    });
    const source = await createFileImportSource({ jsonBytes: bytes(raw) });
    const names = await source.listCollections();
    await source.close();
    expect([...names].sort()).toEqual(["friends", "members", "schemaVersion"]);
  });

  it("listCollections returns empty array for an empty object root", async () => {
    const source = await createFileImportSource({ jsonBytes: bytes("{}") });
    const names = await source.listCollections();
    await source.close();
    expect(names).toEqual([]);
  });
});
