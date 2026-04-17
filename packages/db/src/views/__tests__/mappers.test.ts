import { describe, expect, it } from "vitest";

import {
  mapStructureEntityAssociationRow,
  type RawStructureEntityAssociationRow,
} from "../mappers.js";

describe("mapStructureEntityAssociationRow", () => {
  it("maps snake_case row to camelCase model", () => {
    const raw: RawStructureEntityAssociationRow = {
      id: "a1",
      system_id: "s1",
      source_entity_id: "ste_src",
      target_entity_id: "ste_tgt",
      created_at: 1_700_000_000_000,
    };

    const mapped = mapStructureEntityAssociationRow(raw);

    expect(mapped).toEqual({
      id: "a1",
      systemId: "s1",
      sourceEntityId: "ste_src",
      targetEntityId: "ste_tgt",
      createdAt: 1_700_000_000_000,
    });
  });

  it("normalises ISO-8601 created_at string to a unix-millis number", () => {
    const iso = "2023-11-14T22:13:20.000Z";
    const raw: RawStructureEntityAssociationRow = {
      id: "a2",
      system_id: "s1",
      source_entity_id: "ste_src",
      target_entity_id: "ste_tgt",
      created_at: iso,
    };

    const mapped = mapStructureEntityAssociationRow(raw);

    expect(mapped.createdAt).toBe(new Date(iso).getTime());
    expect(typeof mapped.createdAt).toBe("number");
  });

  it("passes through numeric created_at without conversion", () => {
    const raw: RawStructureEntityAssociationRow = {
      id: "a3",
      system_id: "s1",
      source_entity_id: "ste_src",
      target_entity_id: "ste_tgt",
      created_at: 0,
    };

    const mapped = mapStructureEntityAssociationRow(raw);

    expect(mapped.createdAt).toBe(0);
  });

  it("returns a plain object with only the expected keys", () => {
    const raw: RawStructureEntityAssociationRow = {
      id: "a4",
      system_id: "s1",
      source_entity_id: "ste_src",
      target_entity_id: "ste_tgt",
      created_at: 42,
    };

    const mapped = mapStructureEntityAssociationRow(raw);

    expect(Object.keys(mapped).sort()).toEqual([
      "createdAt",
      "id",
      "sourceEntityId",
      "systemId",
      "targetEntityId",
    ]);
  });
});
