/**
 * Shared fixture builders for post-merge-validator test files.
 *
 * Provides helpers used across ≥2 split test files:
 *   - sodium lifecycle (beforeAll init)
 *   - makeKeys / makeSessions / makeGroup / makeRegion
 *   - makeWebhookSession for webhook-config tests
 *   - Immutable string shorthand `s`
 */
import * as Automerge from "@automerge/automerge";
import { WasmSodiumAdapter } from "@pluralscape/crypto/wasm";

import { createSystemCoreDocument, fromDoc } from "../../factories/document-factory.js";
import { EncryptedRelay } from "../../relay.js";
import { EncryptedSyncSession } from "../../sync-session.js";
import { asSyncDocId } from "../test-crypto-helpers.js";

import type { CrdtGroup, CrdtInnerWorldRegion } from "../../schemas/system-core.js";
import type { DocumentKeys } from "../../types.js";
import type { SodiumAdapter } from "@pluralscape/crypto";
import type { SyncDocumentId } from "@pluralscape/types";

// ── Sodium singleton ──────────────────────────────────────────────────

/**
 * Module-level sodium adapter initialised once per test file via beforeAll.
 * Exported so split test files can assign into it and call makeKeys/makeSessions.
 */
export let sodium: SodiumAdapter;

export function setSodium(adapter: SodiumAdapter): void {
  sodium = adapter;
}

export async function initSodium(): Promise<SodiumAdapter> {
  const adapter = new WasmSodiumAdapter();
  await adapter.init();
  sodium = adapter;
  return adapter;
}

// ── Shorthand ─────────────────────────────────────────────────────────

/** Wrap a plain string in an Automerge ImmutableString. */
export const s = (val: string): Automerge.ImmutableString => new Automerge.ImmutableString(val);

// ── Session / key factories ──────────────────────────────────────────

export function makeKeys(): DocumentKeys {
  return {
    encryptionKey: sodium.aeadKeygen(),
    signingKeys: sodium.signKeypair(),
  };
}

export function makeSessions<T>(
  base: Automerge.Doc<T>,
  keys: DocumentKeys,
  docId: SyncDocumentId,
): [EncryptedSyncSession<T>, EncryptedSyncSession<T>] {
  return [
    new EncryptedSyncSession({ doc: Automerge.clone(base), keys, documentId: docId, sodium }),
    new EncryptedSyncSession({ doc: Automerge.clone(base), keys, documentId: docId, sodium }),
  ];
}

/** Convenience: relay + two sessions from a base document. */
export function makeRelayAndSessions<T>(
  base: Automerge.Doc<T>,
  keys: DocumentKeys,
  docId: string,
): { relay: EncryptedRelay; sessionA: EncryptedSyncSession<T>; sessionB: EncryptedSyncSession<T> } {
  const relay = new EncryptedRelay();
  const [sessionA, sessionB] = makeSessions(base, keys, asSyncDocId(docId));
  return { relay, sessionA, sessionB };
}

// ── Entity factories ─────────────────────────────────────────────────

export function makeGroup(
  id: string,
  sortOrder: number,
  overrides?: Partial<{ parentGroupId: string }>,
): CrdtGroup {
  return {
    id: s(id),
    systemId: s("sys_1"),
    name: s(id),
    description: null,
    parentGroupId: overrides?.parentGroupId ? s(overrides.parentGroupId) : null,
    imageSource: null,
    color: null,
    emoji: null,
    sortOrder,
    archived: false,
    createdAt: 1000,
    updatedAt: 1000,
  };
}

export function makeRegion(id: string, parentId?: string): CrdtInnerWorldRegion {
  return {
    id: s(id),
    systemId: s("sys_1"),
    name: s(id),
    description: null,
    parentRegionId: parentId ? s(parentId) : null,
    visual: s("{}"),
    boundaryData: s("[]"),
    accessType: s("open"),
    gatekeeperMemberIds: s("[]"),
    archived: false,
    createdAt: 1000,
    updatedAt: 1000,
  };
}

// ── Webhook session factory ──────────────────────────────────────────

interface WebhookConfigShape {
  url: Automerge.ImmutableString;
  eventTypes: Automerge.ImmutableString[];
  enabled: boolean;
}

interface WebhookTestDocument {
  timers: Record<string, unknown>;
  webhookConfigs: Record<string, WebhookConfigShape>;
}

/** Build a minimal session containing webhookConfigs for validator branch tests. */
export function makeWebhookSession(
  keys: DocumentKeys,
  docId: string,
): EncryptedSyncSession<WebhookTestDocument> {
  const base = fromDoc({ timers: {}, webhookConfigs: {} });
  return new EncryptedSyncSession<WebhookTestDocument>({
    doc: Automerge.clone(base) as Automerge.Doc<WebhookTestDocument>,
    keys,
    documentId: asSyncDocId(docId),
    sodium,
  });
}

/** Build a plain system-core session for tests that only need a single session. */
export function makeSystemCoreSession(
  keys: DocumentKeys,
  docId: string,
): EncryptedSyncSession<ReturnType<typeof createSystemCoreDocument>> {
  return new EncryptedSyncSession({
    doc: Automerge.clone(createSystemCoreDocument()),
    keys,
    documentId: asSyncDocId(docId),
    sodium,
  });
}

// ── Member fixtures ──────────────────────────────────────────────────

interface CrdtMemberShape {
  id: Automerge.ImmutableString;
  systemId: Automerge.ImmutableString;
  name: Automerge.ImmutableString;
  pronouns: Automerge.ImmutableString;
  description: null;
  avatarSource: null;
  colors: Automerge.ImmutableString;
  saturationLevel: Automerge.ImmutableString;
  tags: Automerge.ImmutableString;
  suppressFriendFrontNotification: boolean;
  boardMessageNotificationOnFront: boolean;
  archived: boolean;
  createdAt: number;
  updatedAt: number;
}

/** Minimal active member fixture for tombstone / entity tests. */
export function makeActiveMember(id: string, updatedAt = 1000): CrdtMemberShape {
  return {
    id: s(id),
    systemId: s("sys_1"),
    name: s(id),
    pronouns: s("[]"),
    description: null,
    avatarSource: null,
    colors: s("[]"),
    saturationLevel: s('{"kind":"known","level":"fragment"}'),
    tags: s("[]"),
    suppressFriendFrontNotification: false,
    boardMessageNotificationOnFront: false,
    archived: false,
    createdAt: 1000,
    updatedAt,
  };
}

/** Minimal archived member fixture for tombstone / entity tests. */
export function makeArchivedMember(id: string, updatedAt = 1000): CrdtMemberShape {
  return { ...makeActiveMember(id, updatedAt), archived: true };
}

// ── Fronting session fixture ──────────────────────────────────────────

interface FrontingSessionShape {
  id: Automerge.ImmutableString;
  systemId: Automerge.ImmutableString;
  memberId: Automerge.ImmutableString | null;
  customFrontId: Automerge.ImmutableString | null;
  structureEntityId: Automerge.ImmutableString | null;
  startTime: number;
  endTime: number | null;
  comment: Automerge.ImmutableString | null;
  positionality: Automerge.ImmutableString | null;
  outtrigger: Automerge.ImmutableString | null;
  outtriggerSentiment: Automerge.ImmutableString | null;
  archived: boolean;
  createdAt: number;
  updatedAt: number;
}

/** Build a minimal fronting-session fixture. Defaults to valid (endTime > startTime, has memberId). */
export function makeFrontingSession(
  id: string,
  overrides?: Partial<FrontingSessionShape>,
): FrontingSessionShape {
  return {
    id: s(id),
    systemId: s("sys_1"),
    memberId: s("mem_1"),
    customFrontId: null,
    structureEntityId: null,
    startTime: 1000,
    endTime: 5000,
    comment: null,
    positionality: null,
    outtrigger: null,
    outtriggerSentiment: null,
    archived: false,
    createdAt: 1000,
    updatedAt: 1000,
    ...overrides,
  };
}

// ── Timer fixture ─────────────────────────────────────────────────────

interface TimerShape {
  id: Automerge.ImmutableString;
  systemId: Automerge.ImmutableString;
  intervalMinutes: number | null;
  wakingHoursOnly: boolean | null;
  wakingStart: Automerge.ImmutableString | null;
  wakingEnd: Automerge.ImmutableString | null;
  promptText: Automerge.ImmutableString;
  enabled: boolean;
  archived: boolean;
  createdAt: number;
  updatedAt: number;
}

/** Build a minimal timer fixture. Defaults to valid (positive interval, no waking bounds). */
export function makeTimer(id: string, overrides?: Partial<TimerShape>): TimerShape {
  return {
    id: s(id),
    systemId: s("sys_1"),
    intervalMinutes: 30,
    wakingHoursOnly: false,
    wakingStart: null,
    wakingEnd: null,
    promptText: s("Test"),
    enabled: true,
    archived: false,
    createdAt: 1000,
    updatedAt: 1000,
    ...overrides,
  };
}
