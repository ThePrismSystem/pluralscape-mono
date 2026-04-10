import { describe, expect, it } from "vitest";

import { createFileImportSource, FileSourceParseError } from "../../sources/file-source.js";

function streamFromChunks(chunks: readonly Uint8Array[]): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(chunk);
      controller.close();
    },
  });
}

function textToChunks(text: string, chunkSize: number): Uint8Array[] {
  const bytes = new TextEncoder().encode(text);
  const out: Uint8Array[] = [];
  for (let i = 0; i < bytes.length; i += chunkSize) {
    out.push(bytes.slice(i, i + chunkSize));
  }
  return out;
}

describe("file-source true streaming", () => {
  it("handles a chunk boundary in the middle of a string", async () => {
    const payload = JSON.stringify({
      members: [{ _id: "sp_m_1", name: "Alexander the Great" }],
    });
    const chunks = textToChunks(payload, 23); // forces mid-string boundary
    const source = createFileImportSource({ stream: streamFromChunks(chunks) });

    const docs: unknown[] = [];
    for await (const doc of source.iterate("members")) {
      docs.push(doc);
    }
    expect(docs).toHaveLength(1);
    expect(docs[0]).toMatchObject({
      sourceId: "sp_m_1",
      document: { name: "Alexander the Great" },
    });
  });

  it("handles a chunk boundary splitting a multibyte UTF-8 sequence", async () => {
    const payload = JSON.stringify({
      members: [{ _id: "sp_m_1", name: "Alex 🌟 Star" }],
    });
    const bytes = new TextEncoder().encode(payload);
    // Find the byte offset of the first byte of the 4-byte emoji sequence
    let emojiStart = -1;
    for (let i = 0; i < bytes.length - 3; i += 1) {
      if (
        bytes[i] === 0xf0 &&
        bytes[i + 1] === 0x9f &&
        bytes[i + 2] === 0x8c &&
        bytes[i + 3] === 0x9f
      ) {
        emojiStart = i;
        break;
      }
    }
    if (emojiStart === -1) throw new Error("emoji sequence not found in fixture");
    const splitAt = emojiStart + 2; // Split inside the 4-byte sequence
    const chunks = [bytes.slice(0, splitAt), bytes.slice(splitAt)];
    const source = createFileImportSource({ stream: streamFromChunks(chunks) });

    const docs: { sourceId: string; document: { name: string } }[] = [];
    for await (const doc of source.iterate("members")) {
      docs.push(doc as { sourceId: string; document: { name: string } });
    }
    expect(docs[0]?.document.name).toBe("Alex 🌟 Star");
  });

  it("rejects a non-object root", async () => {
    const payload = '"not an object"';
    const source = createFileImportSource({
      stream: streamFromChunks(textToChunks(payload, 4)),
    });
    await expect(async () => {
      for await (const doc of source.iterate("members")) {
        void doc;
      }
    }).rejects.toBeInstanceOf(FileSourceParseError);
  });

  it("rejects a non-array value under a known collection key", async () => {
    const payload = '{"members": {"notAnArray": true}}';
    const source = createFileImportSource({
      stream: streamFromChunks(textToChunks(payload, 8)),
    });
    await expect(async () => {
      for await (const doc of source.iterate("members")) {
        void doc;
      }
    }).rejects.toBeInstanceOf(FileSourceParseError);
  });

  it("rejects truncated JSON", async () => {
    const payload = '{"members": [{"_id": "sp_m_1", "name": "Al';
    const source = createFileImportSource({
      stream: streamFromChunks(textToChunks(payload, 10)),
    });
    await expect(async () => {
      for await (const doc of source.iterate("members")) {
        void doc;
      }
    }).rejects.toBeInstanceOf(FileSourceParseError);
  });

  it("handles deeply nested objects within a document", async () => {
    const payload = JSON.stringify({
      members: [
        {
          _id: "sp_m_1",
          name: "Alex",
          info: {
            level1: { level2: { level3: { value: 42 } } },
          },
        },
      ],
    });
    const source = createFileImportSource({
      stream: streamFromChunks(textToChunks(payload, 15)),
    });
    const docs: unknown[] = [];
    for await (const doc of source.iterate("members")) {
      docs.push(doc);
    }
    expect(docs).toHaveLength(1);
    const doc = docs[0] as {
      document: { info: { level1: { level2: { level3: { value: number } } } } };
    };
    expect(doc.document.info.level1.level2.level3.value).toBe(42);
  });

  it("lists known and unknown collections via listCollections()", async () => {
    const payload = JSON.stringify({
      members: [],
      unknownCollection: [],
    });
    const source = createFileImportSource({
      stream: streamFromChunks(textToChunks(payload, 20)),
    });
    const cols = await source.listCollections();
    expect(cols).toContain("members");
    expect(cols).toContain("unknownCollection");
  });

  it("yields documents from multiple collections", async () => {
    const payload = JSON.stringify({
      members: [{ _id: "sp_m_1", name: "Alex" }],
      groups: [{ _id: "sp_g_1", name: "close friends" }],
    });
    const source = createFileImportSource({
      stream: streamFromChunks(textToChunks(payload, 10)),
    });
    const members: unknown[] = [];
    for await (const doc of source.iterate("members")) members.push(doc);
    const groups: unknown[] = [];
    for await (const doc of source.iterate("groups")) groups.push(doc);

    expect(members).toHaveLength(1);
    expect(groups).toHaveLength(1);
  });
});
