/**
 * E2E entity assertion helpers for verifying imported SP data.
 *
 * Each function looks up Pluralscape entity IDs via `importEntityRef.lookupBatch`,
 * fetches entities via tRPC `.get` endpoints, decrypts `encryptedData` using
 * transforms from `@pluralscape/data`, and asserts that mapped fields match
 * the manifest expectations.
 */
import {
  decodeAndDecryptT1,
  decryptBoardMessage,
  decryptChannel,
  decryptCustomFront,
  decryptFieldDefinition,
  decryptFrontingComment,
  decryptFrontingSession,
  decryptGroup,
  decryptMember,
  decryptMessage,
  decryptNote,
  decryptPoll,
} from "@pluralscape/data";
import { lookupRefs, lookupSingleRef, requireRef } from "@pluralscape/test-utils/e2e";
import { expect } from "vitest";

import type { TRPCClient } from "./e2e-helpers.js";
import type { Manifest, ManifestEntry } from "../integration/manifest.types.js";
import type { KdfMasterKey } from "@pluralscape/crypto";
import type { SystemId } from "@pluralscape/types";

const SOURCE = "simply-plural" as const;

// ── Ref lookup wrapper ──────────────────────────────────────────────────

/**
 * Look up a batch of SP source IDs and return the mapping from source ID
 * to Pluralscape entity ID. Asserts that every source ID was resolved.
 */
async function lookupSpRefs(
  trpc: TRPCClient,
  systemId: SystemId,
  sourceEntityType: Parameters<typeof lookupRefs>[3],
  entries: readonly ManifestEntry[],
): Promise<Record<string, string>> {
  if (entries.length === 0) return {};
  return lookupRefs(
    trpc,
    systemId,
    SOURCE,
    sourceEntityType,
    entries.map((e) => e.sourceId),
  );
}

// ── Per-entity-type assertions ─────────────────────────────────────────

export async function assertMembers(
  trpc: TRPCClient,
  masterKey: KdfMasterKey,
  systemId: SystemId,
  manifest: Manifest,
): Promise<void> {
  const refs = await lookupSpRefs(trpc, systemId, "member", manifest.members);

  for (const entry of manifest.members) {
    const memberId = requireRef(refs, entry.sourceId, entry.ref);
    const raw = await trpc.member.get.query({ systemId, memberId });
    const decrypted = decryptMember(raw, masterKey);

    expect(decrypted.name, `${entry.ref}: name`).toBe(entry.fields["name"]);
  }
}

export async function assertGroups(
  trpc: TRPCClient,
  masterKey: KdfMasterKey,
  systemId: SystemId,
  manifest: Manifest,
): Promise<void> {
  const refs = await lookupSpRefs(trpc, systemId, "group", manifest.groups);

  for (const entry of manifest.groups) {
    const groupId = requireRef(refs, entry.sourceId, entry.ref);
    const raw = await trpc.group.get.query({ systemId, groupId });
    const decrypted = decryptGroup(raw, masterKey);

    expect(decrypted.name, `${entry.ref}: name`).toBe(entry.fields["name"]);
    if (entry.fields["desc"] !== undefined) {
      expect(decrypted.description, `${entry.ref}: description`).toBe(entry.fields["desc"]);
    }
  }
}

export async function assertCustomFronts(
  trpc: TRPCClient,
  masterKey: KdfMasterKey,
  systemId: SystemId,
  manifest: Manifest,
): Promise<void> {
  const refs = await lookupSpRefs(trpc, systemId, "custom-front", manifest.customFronts);

  for (const entry of manifest.customFronts) {
    const customFrontId = requireRef(refs, entry.sourceId, entry.ref);
    const raw = await trpc.customFront.get.query({ systemId, customFrontId });
    const decrypted = decryptCustomFront(raw, masterKey);

    expect(decrypted.name, `${entry.ref}: name`).toBe(entry.fields["name"]);
  }
}

export async function assertFieldDefinitions(
  trpc: TRPCClient,
  masterKey: KdfMasterKey,
  systemId: SystemId,
  manifest: Manifest,
): Promise<void> {
  const refs = await lookupSpRefs(trpc, systemId, "field-definition", manifest.customFields);

  for (const entry of manifest.customFields) {
    const fieldDefinitionId = requireRef(refs, entry.sourceId, entry.ref);
    const raw = await trpc.field.definition.get.query({ systemId, fieldDefinitionId });
    const decrypted = decryptFieldDefinition(raw, masterKey);

    expect(decrypted.name, `${entry.ref}: name`).toBe(entry.fields["name"]);
  }
}

export async function assertPrivacyBuckets(
  trpc: TRPCClient,
  masterKey: KdfMasterKey,
  systemId: SystemId,
  manifest: Manifest,
): Promise<void> {
  const refs = await lookupSpRefs(trpc, systemId, "privacy-bucket", manifest.privacyBuckets);

  for (const entry of manifest.privacyBuckets) {
    const bucketId = requireRef(refs, entry.sourceId, entry.ref);
    const raw = await trpc.bucket.get.query({ systemId, bucketId });
    // Privacy buckets are stored encrypted on the server; decrypt manually.
    const decrypted = decodeAndDecryptT1(raw.encryptedData, masterKey) as Record<string, unknown>;

    expect(decrypted["name"], `${entry.ref}: name`).toBe(entry.fields["name"]);
  }
}

export async function assertFrontingSessions(
  trpc: TRPCClient,
  masterKey: KdfMasterKey,
  systemId: SystemId,
  manifest: Manifest,
): Promise<void> {
  const refs = await lookupSpRefs(trpc, systemId, "fronting-session", manifest.frontHistory);

  for (const entry of manifest.frontHistory) {
    const sessionId = requireRef(refs, entry.sourceId, entry.ref);
    const raw = await trpc.frontingSession.get.query({ systemId, sessionId });
    const decrypted = decryptFrontingSession(raw, masterKey);

    if (entry.fields["startTime"] !== undefined) {
      expect(decrypted.startTime, `${entry.ref}: startTime`).toBe(entry.fields["startTime"]);
    }
  }
}

export async function assertFrontingComments(
  trpc: TRPCClient,
  masterKey: KdfMasterKey,
  systemId: SystemId,
  manifest: Manifest,
): Promise<void> {
  const refs = await lookupSpRefs(trpc, systemId, "fronting-comment", manifest.comments);

  for (const entry of manifest.comments) {
    const commentId = requireRef(refs, entry.sourceId, entry.ref);

    // Fronting comment get requires sessionId — resolve the parent front
    // history document's SP source ID to a Pluralscape fronting session ID.
    const documentId = entry.fields["documentId"];
    expect(documentId, `${entry.ref}: manifest must have documentId`).toBeDefined();
    const sessionId = await lookupSingleRef(
      trpc,
      systemId,
      SOURCE,
      "fronting-session",
      documentId as string,
    );

    const raw = await trpc.frontingComment.get.query({ systemId, sessionId, commentId });
    const decrypted = decryptFrontingComment(raw, masterKey);

    expect(decrypted.content, `${entry.ref}: content`).toBe(entry.fields["text"]);
  }
}

export async function assertNotes(
  trpc: TRPCClient,
  masterKey: KdfMasterKey,
  systemId: SystemId,
  manifest: Manifest,
): Promise<void> {
  const refs = await lookupSpRefs(trpc, systemId, "journal-entry", manifest.notes);

  for (const entry of manifest.notes) {
    const noteId = requireRef(refs, entry.sourceId, entry.ref);
    const raw = await trpc.note.get.query({ systemId, noteId });
    const decrypted = decryptNote(raw, masterKey);

    if (entry.fields["title"] !== undefined) {
      expect(decrypted.title, `${entry.ref}: title`).toBe(entry.fields["title"]);
    }
    if (entry.fields["note"] !== undefined) {
      expect(decrypted.content, `${entry.ref}: content`).toBe(entry.fields["note"]);
    }
  }
}

export async function assertPolls(
  trpc: TRPCClient,
  masterKey: KdfMasterKey,
  systemId: SystemId,
  manifest: Manifest,
): Promise<void> {
  const refs = await lookupSpRefs(trpc, systemId, "poll", manifest.polls);

  for (const entry of manifest.polls) {
    const pollId = requireRef(refs, entry.sourceId, entry.ref);
    const raw = await trpc.poll.get.query({ systemId, pollId });
    const decrypted = decryptPoll(raw, masterKey);

    expect(decrypted.title, `${entry.ref}: title`).toBe(entry.fields["name"]);
  }
}

export async function assertChannelCategories(
  trpc: TRPCClient,
  masterKey: KdfMasterKey,
  systemId: SystemId,
  manifest: Manifest,
): Promise<void> {
  const refs = await lookupSpRefs(trpc, systemId, "channel-category", manifest.channelCategories);

  for (const entry of manifest.channelCategories) {
    const channelId = requireRef(refs, entry.sourceId, entry.ref);
    const raw = await trpc.channel.get.query({ systemId, channelId });
    const decrypted = decryptChannel(raw, masterKey);

    expect(decrypted.name, `${entry.ref}: name`).toBe(entry.fields["name"]);
    expect(decrypted.type, `${entry.ref}: type`).toBe("category");
  }
}

export async function assertChannels(
  trpc: TRPCClient,
  masterKey: KdfMasterKey,
  systemId: SystemId,
  manifest: Manifest,
): Promise<void> {
  const refs = await lookupSpRefs(trpc, systemId, "channel", manifest.channels);

  for (const entry of manifest.channels) {
    const channelId = requireRef(refs, entry.sourceId, entry.ref);
    const raw = await trpc.channel.get.query({ systemId, channelId });
    const decrypted = decryptChannel(raw, masterKey);

    expect(decrypted.name, `${entry.ref}: name`).toBe(entry.fields["name"]);
    expect(decrypted.type, `${entry.ref}: type`).toBe("channel");
  }
}

export async function assertChatMessages(
  trpc: TRPCClient,
  masterKey: KdfMasterKey,
  systemId: SystemId,
  manifest: Manifest,
): Promise<void> {
  const refs = await lookupSpRefs(trpc, systemId, "chat-message", manifest.chatMessages);

  for (const entry of manifest.chatMessages) {
    const messageId = requireRef(refs, entry.sourceId, entry.ref);

    // Chat message get requires channelId — resolve the parent channel's
    // SP source ID to a Pluralscape channel ID.
    const channelSourceId = entry.fields["channel"];
    expect(channelSourceId, `${entry.ref}: manifest must have channel`).toBeDefined();
    const channelId = await lookupSingleRef(
      trpc,
      systemId,
      SOURCE,
      "channel",
      channelSourceId as string,
    );

    const raw = await trpc.message.get.query({ systemId, channelId, messageId });
    const decrypted = decryptMessage(raw, masterKey);

    expect(decrypted.content, `${entry.ref}: content`).toBe(entry.fields["message"]);
  }
}

export async function assertBoardMessages(
  trpc: TRPCClient,
  masterKey: KdfMasterKey,
  systemId: SystemId,
  manifest: Manifest,
): Promise<void> {
  const refs = await lookupSpRefs(trpc, systemId, "board-message", manifest.boardMessages);

  for (const entry of manifest.boardMessages) {
    const boardMessageId = requireRef(refs, entry.sourceId, entry.ref);
    const raw = await trpc.boardMessage.get.query({ systemId, boardMessageId });
    const decrypted = decryptBoardMessage(raw, masterKey);

    // The board-message mapper combines title + body into a single content field
    const title = entry.fields["title"] as string | undefined;
    const message = entry.fields["message"] as string;
    const expectedContent = title ? `# ${title}\n\n${message}` : message;
    expect(decrypted.content, `${entry.ref}: content`).toBe(expectedContent);
  }
}
