/**
 * Structure entity and innerworld entity/region/canvas test factories.
 *
 * Covers: makeRawStructureEntity, makeRawStructureEntityType, makeRawInnerworldEntity,
 *         makeRawInnerworldRegion, makeRawCanvas, INNERWORLD_DEFAULT_VISUAL
 * Companion files: shared.ts, member.ts, fronting.ts, comms.ts, misc.ts
 */
import { encryptCanvasUpdate } from "@pluralscape/data/transforms/innerworld-canvas";
import { encryptInnerWorldEntityInput } from "@pluralscape/data/transforms/innerworld-entity";
import { encryptInnerWorldRegionInput } from "@pluralscape/data/transforms/innerworld-region";
import { encryptStructureEntityInput } from "@pluralscape/data/transforms/structure-entity";
import { encryptStructureEntityTypeInput } from "@pluralscape/data/transforms/structure-entity-type";
import { brandId } from "@pluralscape/types";

import { NOW, TEST_MASTER_KEY, TEST_SYSTEM_ID } from "./shared.js";

import type {
  InnerWorldCanvasWire,
  InnerWorldEntityEncryptedInput,
  InnerWorldEntityWire,
  InnerWorldRegionWire,
  SystemStructureEntityTypeId,
  SystemStructureEntityTypeWire,
  SystemStructureEntityWire,
  VisualProperties,
} from "@pluralscape/types";

export const INNERWORLD_DEFAULT_VISUAL: VisualProperties = {
  color: null,
  icon: null,
  size: null,
  opacity: null,
  imageSource: null,
  externalUrl: null,
};

export function makeRawStructureEntity(
  id: string,
  entityTypeId: SystemStructureEntityTypeId = brandId<SystemStructureEntityTypeId>("stet_default"),
  overrides?: Partial<SystemStructureEntityWire>,
): SystemStructureEntityWire {
  const encrypted = encryptStructureEntityInput(
    {
      name: `Entity ${id}`,
      description: "A test entity",
      emoji: null,
      color: null,
      imageSource: null,
    },
    TEST_MASTER_KEY,
  );
  return {
    id,
    systemId: TEST_SYSTEM_ID,
    entityTypeId,
    sortOrder: 0,
    version: 1,
    createdAt: NOW,
    updatedAt: NOW,
    archived: false,
    archivedAt: null,
    ...encrypted,
    ...overrides,
  };
}

export function makeRawStructureEntityType(
  id: string,
  overrides?: Partial<SystemStructureEntityTypeWire>,
): SystemStructureEntityTypeWire {
  const encrypted = encryptStructureEntityTypeInput(
    {
      name: `Type ${id}`,
      description: "A test entity type",
      emoji: null,
      color: null,
      imageSource: null,
    },
    TEST_MASTER_KEY,
  );
  return {
    id,
    systemId: TEST_SYSTEM_ID,
    sortOrder: 0,
    version: 1,
    createdAt: NOW,
    updatedAt: NOW,
    archived: false,
    archivedAt: null,
    ...encrypted,
    ...overrides,
  };
}

export function makeRawInnerworldEntity(
  id: string,
  payload: InnerWorldEntityEncryptedInput,
  overrides?: Partial<InnerWorldEntityWire>,
): InnerWorldEntityWire {
  const encrypted = encryptInnerWorldEntityInput(payload, TEST_MASTER_KEY);
  return {
    id,
    systemId: TEST_SYSTEM_ID,
    regionId: null,
    version: 1,
    createdAt: NOW,
    updatedAt: NOW,
    archived: false,
    archivedAt: null,
    ...encrypted,
    ...overrides,
  };
}

export function makeRawInnerworldRegion(
  id: string,
  overrides?: Partial<InnerWorldRegionWire>,
): InnerWorldRegionWire {
  const encrypted = encryptInnerWorldRegionInput(
    {
      name: `Region ${id}`,
      description: "A test region",
      boundaryData: [
        { x: 0, y: 0 },
        { x: 10, y: 10 },
      ],
      visual: INNERWORLD_DEFAULT_VISUAL,
      gatekeeperMemberIds: [],
      accessType: "open",
    },
    TEST_MASTER_KEY,
  );
  return {
    id,
    systemId: TEST_SYSTEM_ID,
    parentRegionId: null,
    version: 1,
    createdAt: NOW,
    updatedAt: NOW,
    archived: false,
    archivedAt: null,
    ...encrypted,
    ...overrides,
  };
}

export function makeRawCanvas(overrides?: Partial<InnerWorldCanvasWire>): InnerWorldCanvasWire {
  const encrypted = encryptCanvasUpdate(
    {
      viewportX: 0,
      viewportY: 0,
      zoom: 1,
      dimensions: { width: 1000, height: 800 },
    },
    1,
    TEST_MASTER_KEY,
  );
  return {
    systemId: TEST_SYSTEM_ID,
    encryptedData: encrypted.encryptedData,
    version: 1,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}
