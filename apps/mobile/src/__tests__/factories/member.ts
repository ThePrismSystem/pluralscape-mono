/**
 * Member and custom-front test factories.
 *
 * Covers: makeRawMember, makeRawCustomFront
 * Companion files: shared.ts, fronting.ts, comms.ts, structure-innerworld.ts, misc.ts
 */
import { encryptCustomFrontInput } from "@pluralscape/data/transforms/custom-front";
import { encryptMemberInput } from "@pluralscape/data/transforms/member";

import { NOW, TEST_MASTER_KEY, TEST_SYSTEM_ID } from "./shared.js";

import type { CustomFrontWire, MemberWire } from "@pluralscape/types";

export function makeRawMember(id: string, overrides?: Partial<MemberWire>): MemberWire {
  const encrypted = encryptMemberInput(
    {
      name: `Member ${id}`,
      pronouns: ["they/them"],
      description: "A test member",
      avatarSource: null,
      colors: [],
      saturationLevel: { kind: "known", level: "highly-elaborated" },
      tags: [],
      suppressFriendFrontNotification: false,
      boardMessageNotificationOnFront: false,
    },
    TEST_MASTER_KEY,
  );
  return {
    id,
    systemId: TEST_SYSTEM_ID,
    version: 1,
    createdAt: NOW,
    updatedAt: NOW,
    archived: false,
    archivedAt: null,
    ...encrypted,
    ...overrides,
  };
}

export function makeRawCustomFront(
  id: string,
  overrides?: Partial<CustomFrontWire>,
): CustomFrontWire {
  const encrypted = encryptCustomFrontInput(
    {
      name: `Front ${id}`,
      description: "A test front",
      color: null,
      emoji: null,
    },
    TEST_MASTER_KEY,
  );
  return {
    id,
    systemId: TEST_SYSTEM_ID,
    version: 1,
    createdAt: NOW,
    updatedAt: NOW,
    archived: false,
    archivedAt: null,
    ...encrypted,
    ...overrides,
  };
}
