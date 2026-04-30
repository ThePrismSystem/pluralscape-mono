/**
 * Fronting session, comment, report, and group test factories.
 *
 * Covers: makeRawFrontingSession, makeRawFrontingComment, makeRawFrontingReport, makeRawGroup
 * Companion files: shared.ts, member.ts, comms.ts, structure-innerworld.ts, misc.ts
 */
import { encryptFrontingCommentInput } from "@pluralscape/data/transforms/fronting-comment";
import { encryptFrontingReportInput } from "@pluralscape/data/transforms/fronting-report";
import { encryptFrontingSessionInput } from "@pluralscape/data/transforms/fronting-session";
import { encryptGroupInput } from "@pluralscape/data/transforms/group";
import { brandId, brandValue } from "@pluralscape/types";

import { NOW, TEST_MASTER_KEY, TEST_SYSTEM_ID } from "./shared.js";

import type {
  EncryptedBase64,
  FrontingCommentWire,
  FrontingReportWire,
  FrontingSessionComment,
  FrontingSessionId,
  FrontingSessionPositionality,
  FrontingSessionWire,
  GroupWire,
  UnixMillis,
} from "@pluralscape/types";

const REPORT_START = 1_699_900_000_000 as UnixMillis;
const REPORT_END = 1_700_000_000_000 as UnixMillis;

export function makeRawFrontingSession(
  id: string,
  overrides?: Partial<FrontingSessionWire>,
): FrontingSessionWire {
  const encrypted = encryptFrontingSessionInput(
    {
      comment: brandValue<FrontingSessionComment>(`Session ${id}`),
      positionality: brandValue<FrontingSessionPositionality>("close"),
      outtrigger: null,
      outtriggerSentiment: null,
    },
    TEST_MASTER_KEY,
  );
  return {
    id,
    systemId: TEST_SYSTEM_ID,
    memberId: "m-1",
    customFrontId: null,
    structureEntityId: null,
    startTime: NOW,
    endTime: null,
    version: 1,
    createdAt: NOW,
    updatedAt: NOW,
    archived: false,
    archivedAt: null,
    encryptedData: encrypted.encryptedData as EncryptedBase64,
    ...overrides,
  } as FrontingSessionWire;
}

export function makeRawFrontingComment(
  id: string,
  sessionId: FrontingSessionId = brandId<FrontingSessionId>("fs-1"),
  overrides?: Partial<FrontingCommentWire>,
): FrontingCommentWire {
  const encrypted = encryptFrontingCommentInput({ content: `Comment ${id}` }, TEST_MASTER_KEY);
  return {
    id,
    frontingSessionId: sessionId,
    systemId: TEST_SYSTEM_ID,
    memberId: "m-1",
    customFrontId: null,
    structureEntityId: null,
    version: 1,
    createdAt: NOW,
    updatedAt: NOW,
    archived: false,
    archivedAt: null,
    ...encrypted,
    ...overrides,
  } as FrontingCommentWire;
}

export function makeRawFrontingReport(
  id: string,
  overrides?: Partial<FrontingReportWire>,
): FrontingReportWire {
  const encrypted = encryptFrontingReportInput(
    {
      dateRange: { start: REPORT_START, end: REPORT_END },
      memberBreakdowns: [],
      chartData: [],
    },
    TEST_MASTER_KEY,
  );
  return {
    id,
    systemId: TEST_SYSTEM_ID,
    format: "html",
    generatedAt: NOW,
    version: 1,
    archived: false,
    archivedAt: null,
    ...encrypted,
    ...overrides,
  };
}

export function makeRawGroup(id: string, overrides?: Partial<GroupWire>): GroupWire {
  const encrypted = encryptGroupInput(
    {
      name: `Group ${id}`,
      description: "A test group",
      imageSource: null,
      color: null,
      emoji: null,
    },
    TEST_MASTER_KEY,
  );
  return {
    id,
    systemId: TEST_SYSTEM_ID,
    parentGroupId: null,
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
