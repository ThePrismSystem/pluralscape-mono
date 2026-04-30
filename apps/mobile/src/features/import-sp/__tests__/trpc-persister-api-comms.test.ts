/**
 * tRPC PersisterApi bridge tests — poll, channel, message, boardMessage.
 *
 * Companion files: trpc-persister-api-core.test.ts,
 *                  trpc-persister-api-fronting.test.ts,
 *                  trpc-persister-api-bulk.test.ts
 */

import { brandId } from "@pluralscape/types";
import { describe, expect, it } from "vitest";

import { createTRPCPersisterApi } from "../trpc-persister-api.js";

import { makeMockClient } from "./helpers/trpc-mock-client.js";

import type { SystemId } from "@pluralscape/types";

const TEST_SYSTEM_ID = brandId<SystemId>("sys_bridge_test");

// ── poll ────────────────────────────────────────────────────────────

describe("poll", () => {
  it("create calls poll.create with poll config fields", async () => {
    const client = makeMockClient();
    client.poll.create.mutate.mockResolvedValue({ id: "poll_1", version: 1 });
    const api = createTRPCPersisterApi(client);

    const result = await api.poll.create(TEST_SYSTEM_ID, {
      encryptedData: "enc_poll",
      kind: "standard",
      allowMultipleVotes: false,
      maxVotesPerMember: 1,
      allowAbstain: true,
      allowVeto: false,
    });

    expect(result).toEqual({ id: "poll_1", version: 1 });
    expect(client.poll.create.mutate).toHaveBeenCalledWith({
      systemId: TEST_SYSTEM_ID,
      encryptedData: "enc_poll",
      kind: "standard",
      createdByMemberId: undefined,
      allowMultipleVotes: false,
      maxVotesPerMember: 1,
      allowAbstain: true,
      allowVeto: false,
    });
  });

  it("update calls poll.update with pollId", async () => {
    const client = makeMockClient();
    client.poll.update.mutate.mockResolvedValue({ id: "poll_1", version: 2 });
    const api = createTRPCPersisterApi(client);

    const result = await api.poll.update(TEST_SYSTEM_ID, "poll_1", {
      encryptedData: "enc_poll_v2",
      version: 1,
    });

    expect(result).toEqual({ id: "poll_1", version: 2 });
    expect(client.poll.update.mutate).toHaveBeenCalledWith({
      systemId: TEST_SYSTEM_ID,
      pollId: "poll_1",
      encryptedData: "enc_poll_v2",
      version: 1,
    });
  });

  it("castVote calls poll.castVote with pollId and voter info", async () => {
    const client = makeMockClient();
    client.poll.castVote.mutate.mockResolvedValue({ id: "pv_1" });
    const api = createTRPCPersisterApi(client);

    const result = await api.poll.castVote(TEST_SYSTEM_ID, {
      pollId: "poll_1",
      memberId: "mem_1",
      encryptedData: "enc_vote",
    });

    expect(result).toEqual({ id: "pv_1" });
    expect(client.poll.castVote.mutate).toHaveBeenCalledWith({
      systemId: TEST_SYSTEM_ID,
      pollId: "poll_1",
      encryptedData: "enc_vote",
    });
  });

  it("castVote handles null memberId", async () => {
    const client = makeMockClient();
    client.poll.castVote.mutate.mockResolvedValue({ id: "pv_2" });
    const api = createTRPCPersisterApi(client);

    const result = await api.poll.castVote(TEST_SYSTEM_ID, {
      pollId: "poll_1",
      memberId: null,
      encryptedData: "enc_vote",
    });

    expect(result).toEqual({ id: "pv_2" });
  });
});

// ── channel ─────────────────────────────────────────────────────────

describe("channel", () => {
  it("create calls channel.create with type, parentId, and sortOrder", async () => {
    const client = makeMockClient();
    client.channel.create.mutate.mockResolvedValue({ id: "ch_1", version: 1 });
    const api = createTRPCPersisterApi(client);

    const result = await api.channel.create(TEST_SYSTEM_ID, {
      encryptedData: "enc_channel",
      type: "channel",
      parentId: null,
      sortOrder: 0,
    });

    expect(result).toEqual({ id: "ch_1", version: 1 });
    expect(client.channel.create.mutate).toHaveBeenCalledWith({
      systemId: TEST_SYSTEM_ID,
      encryptedData: "enc_channel",
      type: "channel",
      parentId: null,
      sortOrder: 0,
    });
  });

  it("create passes non-null parentId through", async () => {
    const client = makeMockClient();
    client.channel.create.mutate.mockResolvedValue({ id: "ch_2", version: 1 });
    const api = createTRPCPersisterApi(client);

    await api.channel.create(TEST_SYSTEM_ID, {
      encryptedData: "enc_channel",
      type: "category",
      parentId: "ch_parent",
      sortOrder: 3,
    });

    expect(client.channel.create.mutate).toHaveBeenCalledWith({
      systemId: TEST_SYSTEM_ID,
      encryptedData: "enc_channel",
      type: "category",
      parentId: "ch_parent",
      sortOrder: 3,
    });
  });

  it("update calls channel.update with channelId", async () => {
    const client = makeMockClient();
    client.channel.update.mutate.mockResolvedValue({ id: "ch_1", version: 2 });
    const api = createTRPCPersisterApi(client);

    const result = await api.channel.update(TEST_SYSTEM_ID, "ch_1", {
      encryptedData: "enc_channel_v2",
      version: 1,
    });

    expect(result).toEqual({ id: "ch_1", version: 2 });
    expect(client.channel.update.mutate).toHaveBeenCalledWith({
      systemId: TEST_SYSTEM_ID,
      channelId: "ch_1",
      encryptedData: "enc_channel_v2",
      version: 1,
    });
  });
});

// ── message ─────────────────────────────────────────────────────────

describe("message", () => {
  it("create calls message.create with channelId and timestamp", async () => {
    const client = makeMockClient();
    client.message.create.mutate.mockResolvedValue({ id: "msg_1", version: 1 });
    const api = createTRPCPersisterApi(client);

    const result = await api.message.create(TEST_SYSTEM_ID, {
      encryptedData: "enc_message",
      channelId: "ch_1",
      timestamp: 1_700_000_000,
      replyToId: null,
    });

    expect(result).toEqual({ id: "msg_1", version: 1 });
    expect(client.message.create.mutate).toHaveBeenCalledWith({
      systemId: TEST_SYSTEM_ID,
      channelId: "ch_1",
      encryptedData: "enc_message",
      timestamp: 1_700_000_000,
      replyToId: null,
    });
  });

  it("update calls message.update with messageId and channelId", async () => {
    const client = makeMockClient();
    client.message.update.mutate.mockResolvedValue({ id: "msg_1", version: 2 });
    const api = createTRPCPersisterApi(client);

    const result = await api.message.update(TEST_SYSTEM_ID, "msg_1", {
      encryptedData: "enc_message_v2",
      version: 1,
      channelId: "ch_real_channel",
    });

    expect(result).toEqual({ id: "msg_1", version: 2 });
    expect(client.message.update.mutate).toHaveBeenCalledWith({
      systemId: TEST_SYSTEM_ID,
      channelId: "ch_real_channel",
      messageId: "msg_1",
      encryptedData: "enc_message_v2",
      version: 1,
    });
  });
});

// ── boardMessage ────────────────────────────────────────────────────

describe("boardMessage", () => {
  it("create calls boardMessage.create with sortOrder", async () => {
    const client = makeMockClient();
    client.boardMessage.create.mutate.mockResolvedValue({ id: "bm_1", version: 1 });
    const api = createTRPCPersisterApi(client);

    const result = await api.boardMessage.create(TEST_SYSTEM_ID, {
      encryptedData: "enc_bm",
      sortOrder: 0,
      pinned: false,
    });

    expect(result).toEqual({ id: "bm_1", version: 1 });
    expect(client.boardMessage.create.mutate).toHaveBeenCalledWith({
      systemId: TEST_SYSTEM_ID,
      encryptedData: "enc_bm",
      sortOrder: 0,
      pinned: false,
    });
  });

  it("update calls boardMessage.update with boardMessageId", async () => {
    const client = makeMockClient();
    client.boardMessage.update.mutate.mockResolvedValue({ id: "bm_1", version: 2 });
    const api = createTRPCPersisterApi(client);

    const result = await api.boardMessage.update(TEST_SYSTEM_ID, "bm_1", {
      encryptedData: "enc_bm_v2",
      version: 1,
    });

    expect(result).toEqual({ id: "bm_1", version: 2 });
    expect(client.boardMessage.update.mutate).toHaveBeenCalledWith({
      systemId: TEST_SYSTEM_ID,
      boardMessageId: "bm_1",
      encryptedData: "enc_bm_v2",
      version: 1,
    });
  });
});

