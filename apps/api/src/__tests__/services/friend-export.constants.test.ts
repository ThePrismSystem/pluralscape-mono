import { FRIEND_EXPORT_ENTITY_TYPES } from "@pluralscape/types";
import { describe, expect, it } from "vitest";

import { EXPORT_TABLE_REGISTRY } from "../../services/friend-export.constants.js";

describe("EXPORT_TABLE_REGISTRY", () => {
  it("has an entry for every FriendExportEntityType", () => {
    for (const entityType of FRIEND_EXPORT_ENTITY_TYPES) {
      expect(EXPORT_TABLE_REGISTRY[entityType]).toBeDefined();
    }
  });

  it("each entry has queryManifestRows and queryExportRows functions", () => {
    for (const [entityType, entry] of Object.entries(EXPORT_TABLE_REGISTRY)) {
      expect(typeof entry.queryManifestRows, `${entityType}: queryManifestRows`).toBe("function");
      expect(typeof entry.queryExportRows, `${entityType}: queryExportRows`).toBe("function");
    }
  });
});
