import { describe, expect, it } from "vitest";

import { createFakeImportSource } from "../../sources/fake-source.js";

describe("createFakeImportSource", () => {
  it("yields documents in insertion order with the right collection name", async () => {
    const source = createFakeImportSource({
      members: [
        { _id: "m1", name: "Aria" },
        { _id: "m2", name: "Bryn" },
      ],
    });
    const out: { collection: string; sourceId: string }[] = [];
    for await (const doc of source.iterate("members")) {
      out.push({ collection: doc.collection, sourceId: doc.sourceId });
    }
    expect(out).toEqual([
      { collection: "members", sourceId: "m1" },
      { collection: "members", sourceId: "m2" },
    ]);
  });

  it("yields nothing for a missing collection", async () => {
    const source = createFakeImportSource({});
    const out: unknown[] = [];
    for await (const doc of source.iterate("groups")) {
      out.push(doc);
    }
    expect(out).toHaveLength(0);
  });

  it("supports multiple iterations of the same collection", async () => {
    const source = createFakeImportSource({ members: [{ _id: "m1", name: "A" }] });
    const first: string[] = [];
    for await (const d of source.iterate("members")) first.push(d.sourceId);
    const second: string[] = [];
    for await (const d of source.iterate("members")) second.push(d.sourceId);
    expect(first).toEqual(second);
  });

  it("exposes mode 'fake'", () => {
    const source = createFakeImportSource({});
    expect(source.mode).toBe("fake");
  });

  it("close is idempotent", async () => {
    const source = createFakeImportSource({});
    await source.close();
    await source.close();
  });

  it("rejects documents missing _id", async () => {
    const source = createFakeImportSource({
      members: [{ name: "no id" }],
    });
    let caught: unknown;
    try {
      const iterator = source.iterate("members")[Symbol.asyncIterator]();
      await iterator.next();
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(Error);
    if (caught instanceof Error) {
      expect(caught.message).toContain("missing _id");
    }
  });
});
