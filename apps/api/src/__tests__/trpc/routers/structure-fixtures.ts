/**
 * Shared fixtures for structure router tests.
 *
 * Each split test file (entity-type, entity, relations) provides its own
 * `vi.mock()` blocks for the structure services — vi.mock is hoisted per
 * file. This module only exports the static IDs and mock result objects
 * consumed by all three split files.
 */
import { brandId } from "@pluralscape/types";

import { MOCK_SYSTEM_ID } from "../../helpers/shared-mocks.js";

import type {
  EncryptedBase64,
  MemberId,
  SystemStructureEntityAssociationId,
  SystemStructureEntityId,
  SystemStructureEntityLinkId,
  SystemStructureEntityMemberLinkId,
  SystemStructureEntityTypeId,
  UnixMillis,
} from "@pluralscape/types";

// ── IDs ──────────────────────────────────────────────────────────────

export const ENTITY_TYPE_ID = brandId<SystemStructureEntityTypeId>(
  "stet_aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
);
export const ENTITY_ID = brandId<SystemStructureEntityId>(
  "ste_aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
);
export const LINK_ID = brandId<SystemStructureEntityLinkId>(
  "stel_aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
);
export const MEMBER_LINK_ID = brandId<SystemStructureEntityMemberLinkId>(
  "steml_aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
);
export const ASSOCIATION_ID = brandId<SystemStructureEntityAssociationId>(
  "stea_aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
);
export const MEMBER_ID = brandId<MemberId>("mem_aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee");

export const VALID_ENCRYPTED_DATA = "dGVzdGRhdGFmb3JtZW1iZXI=";
export const NOW = 1_700_000_000_000 as UnixMillis;

// ── Mock results ─────────────────────────────────────────────────────

export const MOCK_ENTITY_TYPE_RESULT = {
  id: ENTITY_TYPE_ID,
  systemId: MOCK_SYSTEM_ID,
  sortOrder: 0,
  encryptedData: "base64data==" as EncryptedBase64,
  version: 1,
  archived: false,
  archivedAt: null,
  createdAt: NOW,
  updatedAt: NOW,
};

export const MOCK_ENTITY_RESULT = {
  id: ENTITY_ID,
  systemId: MOCK_SYSTEM_ID,
  entityTypeId: ENTITY_TYPE_ID,
  sortOrder: 0,
  encryptedData: "base64data==" as EncryptedBase64,
  version: 1,
  archived: false,
  archivedAt: null,
  createdAt: NOW,
  updatedAt: NOW,
};

export const MOCK_LINK_RESULT = {
  id: LINK_ID,
  systemId: MOCK_SYSTEM_ID,
  entityId: ENTITY_ID,
  parentEntityId: null,
  sortOrder: 0,
  createdAt: NOW,
};

export const MOCK_MEMBER_LINK_RESULT = {
  id: MEMBER_LINK_ID,
  systemId: MOCK_SYSTEM_ID,
  parentEntityId: ENTITY_ID,
  memberId: MEMBER_ID,
  sortOrder: 0,
  createdAt: NOW,
};

export const MOCK_ASSOCIATION_RESULT = {
  id: ASSOCIATION_ID,
  systemId: MOCK_SYSTEM_ID,
  sourceEntityId: ENTITY_ID,
  targetEntityId: ENTITY_ID,
  createdAt: NOW,
};
