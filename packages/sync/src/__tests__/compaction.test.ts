import * as Automerge from "@automerge/automerge";
import { WasmSodiumAdapter } from "@pluralscape/crypto/wasm";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import { checkCompactionEligibility, LazyDocumentSizeTracker } from "../compaction.js";
import { EncryptedSyncSession } from "../sync-session.js";
import { DEFAULT_COMPACTION_CONFIG } from "../types.js";

import type { DocumentKeys } from "../types.js";
import type { SodiumAdapter } from "@pluralscape/crypto";

type SimpleDoc = { items: number[] };

let sodium: SodiumAdapter;

function makeKeys(s: SodiumAdapter): DocumentKeys {
  return {
    encryptionKey: s.aeadKeygen(),
    signingKeys: s.signKeypair(),
  };
}

beforeAll(async () => {
  sodium = new WasmSodiumAdapter();
  await sodium.init();
});

describe("checkCompactionEligibility", () => {
  it("returns not-eligible when below both thresholds", () => {
    const result = checkCompactionEligibility(10, 100_000);
    expect(result.eligible).toBe(false);
    expect(result.reason).toBe("not-eligible");
  });

  it("returns change-threshold when changes reach threshold", () => {
    const result = checkCompactionEligibility(200, 0);
    expect(result.eligible).toBe(true);
    expect(result.reason).toBe("change-threshold");
  });

  it("returns size-threshold when size reaches threshold", () => {
    const result = checkCompactionEligibility(0, 1_048_576);
    expect(result.eligible).toBe(true);
    expect(result.reason).toBe("size-threshold");
  });

  it("returns explicit when explicitly requested", () => {
    const result = checkCompactionEligibility(0, 0, DEFAULT_COMPACTION_CONFIG, true);
    expect(result.eligible).toBe(true);
    expect(result.reason).toBe("explicit");
  });

  it("prefers explicit over other reasons", () => {
    const result = checkCompactionEligibility(999, 999_999_999, DEFAULT_COMPACTION_CONFIG, true);
    expect(result.reason).toBe("explicit");
  });

  it("prefers change-threshold over size-threshold when both met", () => {
    const result = checkCompactionEligibility(200, 1_048_576);
    expect(result.reason).toBe("change-threshold");
  });

  it("echoes changesSinceSnapshot and currentSizeBytes", () => {
    const result = checkCompactionEligibility(42, 999_999);
    expect(result.changesSinceSnapshot).toBe(42);
    expect(result.currentSizeBytes).toBe(999_999);
  });

  it("accepts custom config", () => {
    const config = { changeThreshold: 5, sizeThresholdBytes: 100 };
    expect(checkCompactionEligibility(5, 0, config).eligible).toBe(true);
    expect(checkCompactionEligibility(4, 0, config).eligible).toBe(false);
  });
});

describe("createSnapshot (formerly compactDocument)", () => {
  let keys: DocumentKeys;
  let session: EncryptedSyncSession<SimpleDoc>;

  beforeEach(() => {
    keys = makeKeys(sodium);
    const doc = Automerge.from<SimpleDoc>({ items: [] });
    session = new EncryptedSyncSession({
      doc,
      keys,
      documentId: "fronting-sys_test",
      sodium,
    });
  });

  it("snapshot roundtrip preserves document state", () => {
    session.change((doc) => {
      doc.items.push(1, 2, 3);
    });

    const envelope = session.createSnapshot(1);
    const restored = EncryptedSyncSession.fromSnapshot<SimpleDoc>(envelope, keys, sodium);

    expect(restored.document.items).toEqual([1, 2, 3]);
  });

  it("uses the provided snapshot version", () => {
    const envelope = session.createSnapshot(7);
    expect(envelope.snapshotVersion).toBe(7);
  });

  it("version is monotonically increasing across compactions", () => {
    const env1 = session.createSnapshot(1);
    const env2 = session.createSnapshot(2);
    expect(env2.snapshotVersion).toBeGreaterThan(env1.snapshotVersion);
  });
});

describe("LazyDocumentSizeTracker", () => {
  it("returns initial size without incrementing", () => {
    const doc = Automerge.from<SimpleDoc>({ items: [] });
    const tracker = new LazyDocumentSizeTracker(doc);
    expect(tracker.sizeBytes).toBeGreaterThan(0);
  });

  it("caches size between remeasure intervals", () => {
    const doc = Automerge.from<SimpleDoc>({ items: [] });
    const tracker = new LazyDocumentSizeTracker(doc, 10);
    const initial = tracker.sizeBytes;

    let currentDoc: Automerge.Doc<SimpleDoc> = doc;
    for (let i = 0; i < 9; i++) {
      currentDoc = Automerge.change(currentDoc, (d) => {
        d.items.push(i);
      });
      tracker.increment(currentDoc);
    }

    // Still cached — hasn't hit remeasure interval yet
    expect(tracker.sizeBytes).toBe(initial);
  });

  it("remeasures after N increments", () => {
    const doc = Automerge.from<SimpleDoc>({ items: [] });
    const tracker = new LazyDocumentSizeTracker(doc, 5);
    const initial = tracker.sizeBytes;

    let currentDoc: Automerge.Doc<SimpleDoc> = doc;
    for (let i = 0; i < 5; i++) {
      // Add many items per increment to ensure measurable growth
      currentDoc = Automerge.change(currentDoc, (d) => {
        for (let j = 0; j < 50; j++) {
          d.items.push(j * 1000 + i);
        }
      });
      tracker.increment(currentDoc);
    }

    expect(tracker.sizeBytes).toBeGreaterThan(initial);
  });

  it("reset measures new doc and resets counter", () => {
    const smallDoc = Automerge.from<SimpleDoc>({ items: [] });
    const tracker = new LazyDocumentSizeTracker(smallDoc, 10);
    const smallSize = tracker.sizeBytes;

    let bigDoc: Automerge.Doc<SimpleDoc> = smallDoc;
    for (let i = 0; i < 50; i++) {
      bigDoc = Automerge.change(bigDoc, (d) => {
        d.items.push(i);
      });
    }

    tracker.reset(bigDoc);
    expect(tracker.sizeBytes).toBeGreaterThan(smallSize);
  });
});
