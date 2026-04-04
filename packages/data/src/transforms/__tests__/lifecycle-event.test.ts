import { configureSodium, generateMasterKey, initSodium } from "@pluralscape/crypto";
import { WasmSodiumAdapter } from "@pluralscape/crypto/wasm";
import { toUnixMillis } from "@pluralscape/types";
import { beforeAll, describe, expect, it } from "vitest";

import { encryptAndEncodeT1 } from "../decode-blob.js";
import {
  decryptLifecycleEvent,
  decryptLifecycleEventPage,
  encryptLifecycleEventInput,
  encryptLifecycleEventUpdate,
} from "../lifecycle-event.js";

import { makeBase64Blob } from "./helpers.js";

import type { LifecycleEventEncryptedPayload, LifecycleEventRaw } from "../lifecycle-event.js";
import type { KdfMasterKey } from "@pluralscape/crypto";
import type { LifecycleEventId, LifecycleEventType, SystemId } from "@pluralscape/types";

let masterKey: KdfMasterKey;

beforeAll(async () => {
  configureSodium(new WasmSodiumAdapter());
  await initSodium();
  masterKey = generateMasterKey();
});

const NOW = toUnixMillis(1_700_000_000_000);
const LATER = toUnixMillis(1_700_001_000_000);

function makeRaw(
  eventType: LifecycleEventType,
  payload: LifecycleEventEncryptedPayload,
  plaintextMetadata: Record<string, readonly string[]> | null,
  overrides?: Partial<LifecycleEventRaw>,
): LifecycleEventRaw {
  return {
    id: "evt_001" as LifecycleEventId,
    systemId: "sys_test" as SystemId,
    eventType,
    occurredAt: NOW,
    recordedAt: NOW,
    updatedAt: NOW,
    encryptedData: encryptAndEncodeT1(payload, masterKey),
    plaintextMetadata,
    version: 1,
    archived: false,
    archivedAt: null,
    ...overrides,
  };
}

// ── Split ─────────────────────────────────────────────────────────────

describe("decryptLifecycleEvent — split", () => {
  it("decrypts split event", () => {
    const payload: LifecycleEventEncryptedPayload = { notes: "Split happened" };
    const meta = { memberIds: ["mem_src", "mem_r1", "mem_r2"] };
    const result = decryptLifecycleEvent(makeRaw("split", payload, meta), masterKey);

    expect(result.eventType).toBe("split");
    if (result.eventType === "split") {
      expect(result.sourceMemberId).toBe("mem_src");
      expect(result.resultMemberIds).toEqual(["mem_r1", "mem_r2"]);
    }
    expect(result.notes).toBe("Split happened");
  });
});

// ── Fusion ────────────────────────────────────────────────────────────

describe("decryptLifecycleEvent — fusion", () => {
  it("decrypts fusion event", () => {
    const payload: LifecycleEventEncryptedPayload = { notes: null };
    const meta = { memberIds: ["mem_a", "mem_b", "mem_result"] };
    const result = decryptLifecycleEvent(makeRaw("fusion", payload, meta), masterKey);

    expect(result.eventType).toBe("fusion");
    if (result.eventType === "fusion") {
      expect(result.sourceMemberIds).toEqual(["mem_a", "mem_b"]);
      expect(result.resultMemberId).toBe("mem_result");
    }
    expect(result.notes).toBeNull();
  });
});

// ── Merge ─────────────────────────────────────────────────────────────

describe("decryptLifecycleEvent — merge", () => {
  it("decrypts merge event", () => {
    const payload: LifecycleEventEncryptedPayload = { notes: null };
    const meta = { memberIds: ["mem_a", "mem_b"] };
    const result = decryptLifecycleEvent(makeRaw("merge", payload, meta), masterKey);

    expect(result.eventType).toBe("merge");
    if (result.eventType === "merge") {
      expect(result.memberIds).toEqual(["mem_a", "mem_b"]);
    }
  });
});

// ── Unmerge ───────────────────────────────────────────────────────────

describe("decryptLifecycleEvent — unmerge", () => {
  it("decrypts unmerge event", () => {
    const payload: LifecycleEventEncryptedPayload = { notes: null };
    const meta = { memberIds: ["mem_a", "mem_b"] };
    const result = decryptLifecycleEvent(makeRaw("unmerge", payload, meta), masterKey);

    expect(result.eventType).toBe("unmerge");
    if (result.eventType === "unmerge") {
      expect(result.memberIds).toEqual(["mem_a", "mem_b"]);
    }
  });
});

// ── Dormancy Start ────────────────────────────────────────────────────

describe("decryptLifecycleEvent — dormancy-start", () => {
  it("decrypts dormancy-start with relatedLifecycleEventId", () => {
    const payload: LifecycleEventEncryptedPayload = {
      notes: null,
      relatedLifecycleEventId: "evt_related" as LifecycleEventId,
    };
    const meta = { memberIds: ["mem_a"] };
    const result = decryptLifecycleEvent(makeRaw("dormancy-start", payload, meta), masterKey);

    expect(result.eventType).toBe("dormancy-start");
    if (result.eventType === "dormancy-start") {
      expect(result.memberId).toBe("mem_a");
      expect(result.relatedLifecycleEventId).toBe("evt_related");
    }
  });

  it("decrypts dormancy-start with null relatedLifecycleEventId", () => {
    const payload: LifecycleEventEncryptedPayload = {
      notes: null,
      relatedLifecycleEventId: null,
    };
    const meta = { memberIds: ["mem_a"] };
    const result = decryptLifecycleEvent(makeRaw("dormancy-start", payload, meta), masterKey);

    if (result.eventType === "dormancy-start") {
      expect(result.relatedLifecycleEventId).toBeNull();
    }
  });
});

// ── Dormancy End ──────────────────────────────────────────────────────

describe("decryptLifecycleEvent — dormancy-end", () => {
  it("decrypts dormancy-end event", () => {
    const payload: LifecycleEventEncryptedPayload = {
      notes: "Woke up",
      relatedLifecycleEventId: "evt_start" as LifecycleEventId,
    };
    const meta = { memberIds: ["mem_a"] };
    const result = decryptLifecycleEvent(makeRaw("dormancy-end", payload, meta), masterKey);

    expect(result.eventType).toBe("dormancy-end");
    if (result.eventType === "dormancy-end") {
      expect(result.memberId).toBe("mem_a");
      expect(result.relatedLifecycleEventId).toBe("evt_start");
      expect(result.notes).toBe("Woke up");
    }
  });
});

// ── Discovery ─────────────────────────────────────────────────────────

describe("decryptLifecycleEvent — discovery", () => {
  it("decrypts discovery event", () => {
    const payload: LifecycleEventEncryptedPayload = { notes: "New member found" };
    const meta = { memberIds: ["mem_new"] };
    const result = decryptLifecycleEvent(makeRaw("discovery", payload, meta), masterKey);

    expect(result.eventType).toBe("discovery");
    if (result.eventType === "discovery") {
      expect(result.memberId).toBe("mem_new");
    }
    expect(result.notes).toBe("New member found");
  });
});

// ── Archival ──────────────────────────────────────────────────────────

describe("decryptLifecycleEvent — archival", () => {
  it("decrypts archival event", () => {
    const payload: LifecycleEventEncryptedPayload = {
      notes: null,
      entity: { entityType: "member", entityId: "mem_archived" },
    };
    const meta = { memberIds: ["mem_archived"] };
    const result = decryptLifecycleEvent(makeRaw("archival", payload, meta), masterKey);

    expect(result.eventType).toBe("archival");
    if (result.eventType === "archival") {
      expect(result.entity).toEqual({ entityType: "member", entityId: "mem_archived" });
    }
  });
});

// ── Structure Entity Formation ────────────────────────────────────────

describe("decryptLifecycleEvent — structure-entity-formation", () => {
  it("decrypts structure-entity-formation event", () => {
    const payload: LifecycleEventEncryptedPayload = { notes: null };
    const meta = { memberIds: ["mem_a"], structureIds: ["se_result"] };
    const result = decryptLifecycleEvent(
      makeRaw("structure-entity-formation", payload, meta),
      masterKey,
    );

    expect(result.eventType).toBe("structure-entity-formation");
    if (result.eventType === "structure-entity-formation") {
      expect(result.memberId).toBe("mem_a");
      expect(result.resultStructureEntityId).toBe("se_result");
    }
  });
});

// ── Form Change ───────────────────────────────────────────────────────

describe("decryptLifecycleEvent — form-change", () => {
  it("decrypts form-change event", () => {
    const payload: LifecycleEventEncryptedPayload = {
      notes: null,
      previousForm: "child",
      newForm: "adult",
    };
    const meta = { memberIds: ["mem_a"] };
    const result = decryptLifecycleEvent(makeRaw("form-change", payload, meta), masterKey);

    expect(result.eventType).toBe("form-change");
    if (result.eventType === "form-change") {
      expect(result.memberId).toBe("mem_a");
      expect(result.previousForm).toBe("child");
      expect(result.newForm).toBe("adult");
    }
  });

  it("handles null previousForm and newForm", () => {
    const payload: LifecycleEventEncryptedPayload = {
      notes: null,
      previousForm: null,
      newForm: null,
    };
    const meta = { memberIds: ["mem_a"] };
    const result = decryptLifecycleEvent(makeRaw("form-change", payload, meta), masterKey);

    if (result.eventType === "form-change") {
      expect(result.previousForm).toBeNull();
      expect(result.newForm).toBeNull();
    }
  });
});

// ── Name Change ───────────────────────────────────────────────────────

describe("decryptLifecycleEvent — name-change", () => {
  it("decrypts name-change event", () => {
    const payload: LifecycleEventEncryptedPayload = {
      notes: null,
      previousName: "Old Name",
      newName: "New Name",
    };
    const meta = { memberIds: ["mem_a"] };
    const result = decryptLifecycleEvent(makeRaw("name-change", payload, meta), masterKey);

    expect(result.eventType).toBe("name-change");
    if (result.eventType === "name-change") {
      expect(result.memberId).toBe("mem_a");
      expect(result.previousName).toBe("Old Name");
      expect(result.newName).toBe("New Name");
    }
  });

  it("handles null previousName", () => {
    const payload: LifecycleEventEncryptedPayload = {
      notes: null,
      previousName: null,
      newName: "First Name",
    };
    const meta = { memberIds: ["mem_a"] };
    const result = decryptLifecycleEvent(makeRaw("name-change", payload, meta), masterKey);

    if (result.eventType === "name-change") {
      expect(result.previousName).toBeNull();
      expect(result.newName).toBe("First Name");
    }
  });
});

// ── Structure Move ────────────────────────────────────────────────────

describe("decryptLifecycleEvent — structure-move", () => {
  it("decrypts with fromStructure and toStructure (2 structureIds)", () => {
    const payload: LifecycleEventEncryptedPayload = { notes: null };
    const meta = { memberIds: ["mem_a"], structureIds: ["se_from", "se_to"] };
    const result = decryptLifecycleEvent(makeRaw("structure-move", payload, meta), masterKey);

    expect(result.eventType).toBe("structure-move");
    if (result.eventType === "structure-move") {
      expect(result.memberId).toBe("mem_a");
      expect(result.fromStructure).toEqual({
        entityType: "structure-entity",
        entityId: "se_from",
      });
      expect(result.toStructure).toEqual({
        entityType: "structure-entity",
        entityId: "se_to",
      });
    }
  });

  it("decrypts with null fromStructure (1 structureId)", () => {
    const payload: LifecycleEventEncryptedPayload = { notes: null };
    const meta = { memberIds: ["mem_a"], structureIds: ["se_to"] };
    const result = decryptLifecycleEvent(makeRaw("structure-move", payload, meta), masterKey);

    if (result.eventType === "structure-move") {
      expect(result.fromStructure).toBeNull();
      expect(result.toStructure).toEqual({
        entityType: "structure-entity",
        entityId: "se_to",
      });
    }
  });
});

// ── Innerworld Move ───────────────────────────────────────────────────

describe("decryptLifecycleEvent — innerworld-move", () => {
  it("decrypts with fromRegionId and toRegionId (2 regionIds)", () => {
    const payload: LifecycleEventEncryptedPayload = {
      notes: null,
      entityType: "member",
    };
    const meta = { entityIds: ["iwe_a"], regionIds: ["reg_from", "reg_to"] };
    const result = decryptLifecycleEvent(makeRaw("innerworld-move", payload, meta), masterKey);

    expect(result.eventType).toBe("innerworld-move");
    if (result.eventType === "innerworld-move") {
      expect(result.entityId).toBe("iwe_a");
      expect(result.entityType).toBe("member");
      expect(result.fromRegionId).toBe("reg_from");
      expect(result.toRegionId).toBe("reg_to");
    }
  });

  it("decrypts with only toRegionId (1 regionId)", () => {
    const payload: LifecycleEventEncryptedPayload = {
      notes: null,
      entityType: "landmark",
    };
    const meta = { entityIds: ["iwe_a"], regionIds: ["reg_to"] };
    const result = decryptLifecycleEvent(makeRaw("innerworld-move", payload, meta), masterKey);

    if (result.eventType === "innerworld-move") {
      expect(result.fromRegionId).toBeNull();
      expect(result.toRegionId).toBe("reg_to");
    }
  });

  it("decrypts with both null (0 regionIds)", () => {
    const payload: LifecycleEventEncryptedPayload = {
      notes: null,
      entityType: "structure-entity",
    };
    const meta = { entityIds: ["iwe_a"], regionIds: [] };
    const result = decryptLifecycleEvent(makeRaw("innerworld-move", payload, meta), masterKey);

    if (result.eventType === "innerworld-move") {
      expect(result.fromRegionId).toBeNull();
      expect(result.toRegionId).toBeNull();
    }
  });
});

// ── Shared behaviors ──────────────────────────────────────────────────

describe("decryptLifecycleEvent — shared", () => {
  it("defaults notes to null when encryptedData is null", () => {
    const raw = makeRaw(
      "discovery",
      { notes: null },
      { memberIds: ["mem_a"] },
      {
        encryptedData: null,
      },
    );
    const result = decryptLifecycleEvent(raw, masterKey);
    expect(result.notes).toBeNull();
  });

  it("returns archived variant with archivedAt", () => {
    const payload: LifecycleEventEncryptedPayload = { notes: null };
    const meta = { memberIds: ["mem_a"] };
    const raw = makeRaw("discovery", payload, meta, {
      archived: true,
      archivedAt: LATER,
    });
    const result = decryptLifecycleEvent(raw, masterKey);

    expect(result.archived).toBe(true);
    if (result.archived) {
      expect(result.archivedAt).toBe(LATER);
    }
  });

  it("throws when archived=true but archivedAt is null", () => {
    const payload: LifecycleEventEncryptedPayload = { notes: null };
    const meta = { memberIds: ["mem_a"] };
    const raw = makeRaw("discovery", payload, meta, {
      archived: true,
      archivedAt: null,
    });
    expect(() => decryptLifecycleEvent(raw, masterKey)).toThrow("missing archivedAt");
  });
});

// ── Page ──────────────────────────────────────────────────────────────

describe("decryptLifecycleEventPage", () => {
  it("decrypts all items and preserves cursor", () => {
    const page = {
      data: [
        makeRaw("discovery", { notes: null }, { memberIds: ["mem_a"] }),
        makeRaw("merge", { notes: null }, { memberIds: ["mem_a", "mem_b"] }),
      ],
      nextCursor: "cursor_abc",
    };
    const result = decryptLifecycleEventPage(page, masterKey);
    expect(result.data).toHaveLength(2);
    expect(result.nextCursor).toBe("cursor_abc");
  });

  it("handles empty page", () => {
    const result = decryptLifecycleEventPage({ data: [], nextCursor: null }, masterKey);
    expect(result.data).toHaveLength(0);
    expect(result.nextCursor).toBeNull();
  });
});

// ── Encrypt input/update ──────────────────────────────────────────────

describe("encryptLifecycleEventInput", () => {
  it("round-trips through decrypt", () => {
    const payload: LifecycleEventEncryptedPayload = { notes: "Test note" };
    const { encryptedData } = encryptLifecycleEventInput(payload, masterKey);
    const raw = makeRaw("discovery", payload, { memberIds: ["mem_a"] }, { encryptedData });
    const result = decryptLifecycleEvent(raw, masterKey);
    expect(result.notes).toBe("Test note");
  });
});

describe("encryptLifecycleEventUpdate", () => {
  it("includes version", () => {
    const payload: LifecycleEventEncryptedPayload = { notes: null };
    const result = encryptLifecycleEventUpdate(payload, 5, masterKey);
    expect(result.version).toBe(5);
    expect(typeof result.encryptedData).toBe("string");
  });
});

// ── Validation ────────────────────────────────────────────────────────

describe("assertLifecycleEventPayload", () => {
  it("throws when blob is not an object", () => {
    const raw = makeRaw(
      "discovery",
      { notes: null },
      { memberIds: ["mem_a"] },
      {
        encryptedData: makeBase64Blob("string", masterKey),
      },
    );
    expect(() => decryptLifecycleEvent(raw, masterKey)).toThrow("not an object");
  });
});

// ── Metadata validation ───────────────────────────────────────────────

describe("decryptLifecycleEvent — metadata validation", () => {
  it("throws on discovery with empty memberIds", () => {
    const raw = makeRaw("discovery", { notes: null }, { memberIds: [] });
    expect(() => decryptLifecycleEvent(raw, masterKey)).toThrow("missing required memberIds");
  });

  it("throws on split with fewer than 2 memberIds", () => {
    const raw = makeRaw("split", { notes: null }, { memberIds: ["mem_only"] });
    expect(() => decryptLifecycleEvent(raw, masterKey)).toThrow(
      "split requires at least 2 memberIds",
    );
  });

  it("throws on fusion with fewer than 2 memberIds", () => {
    const raw = makeRaw("fusion", { notes: null }, { memberIds: ["mem_only"] });
    expect(() => decryptLifecycleEvent(raw, masterKey)).toThrow(
      "fusion requires at least 2 memberIds",
    );
  });

  it("throws on structure-entity-formation with empty structureIds", () => {
    const raw = makeRaw(
      "structure-entity-formation",
      { notes: null },
      { memberIds: ["mem_a"], structureIds: [] },
    );
    expect(() => decryptLifecycleEvent(raw, masterKey)).toThrow("missing required structureIds");
  });

  it("throws on structure-move with empty structureIds", () => {
    const raw = makeRaw(
      "structure-move",
      { notes: null },
      { memberIds: ["mem_a"], structureIds: [] },
    );
    expect(() => decryptLifecycleEvent(raw, masterKey)).toThrow("missing required structureIds");
  });

  it("throws on innerworld-move with empty entityIds", () => {
    const raw = makeRaw(
      "innerworld-move",
      { notes: null, entityType: "member" },
      { entityIds: [], regionIds: [] },
    );
    expect(() => decryptLifecycleEvent(raw, masterKey)).toThrow("missing required entityIds");
  });

  it("throws on archival with missing payload.entity", () => {
    const raw = makeRaw("archival", { notes: null }, { memberIds: ["mem_a"] });
    expect(() => decryptLifecycleEvent(raw, masterKey)).toThrow("missing required field: entity");
  });

  it("throws on name-change with missing payload.newName", () => {
    const raw = makeRaw(
      "name-change",
      { notes: null, previousName: "Old" },
      { memberIds: ["mem_a"] },
    );
    expect(() => decryptLifecycleEvent(raw, masterKey)).toThrow("missing required field: newName");
  });
});
