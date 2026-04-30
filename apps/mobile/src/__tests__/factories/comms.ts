/**
 * Communication entity test factories: channels, messages, board messages, polls, acknowledgements.
 *
 * Covers: makeRawChannel, makeRawMessage, makeRawBoardMessage, makeRawPoll, makeRawPollVote,
 *         makeRawAcknowledgement
 * Companion files: shared.ts, member.ts, fronting.ts, structure-innerworld.ts, misc.ts
 */
import { encryptAcknowledgementInput } from "@pluralscape/data/transforms/acknowledgement";
import { encryptBoardMessageInput } from "@pluralscape/data/transforms/board-message";
import { encryptChannelInput } from "@pluralscape/data/transforms/channel";
import { encryptMessageInput } from "@pluralscape/data/transforms/message";
import { encryptPollInput, encryptPollVoteInput } from "@pluralscape/data/transforms/poll";
import { brandId, brandValue } from "@pluralscape/types";

import { NOW, TEST_MASTER_KEY, TEST_SYSTEM_ID } from "./shared.js";

import type {
  AcknowledgementRequestWire,
  BoardMessageWire,
  ChannelId,
  ChannelWire,
  ChatMessageWire,
  MemberId,
  PollOptionId,
  PollOptionLabel,
  PollTitle,
  PollVoteWire,
  PollWire,
} from "@pluralscape/types";

export function makeRawAcknowledgement(
  id: string,
  overrides?: Partial<AcknowledgementRequestWire>,
): AcknowledgementRequestWire {
  const encrypted = encryptAcknowledgementInput(
    {
      message: "Please read",
      targetMemberId: brandId<MemberId>("m-1"),
      confirmedAt: null,
    },
    TEST_MASTER_KEY,
  );
  return {
    id,
    systemId: TEST_SYSTEM_ID,
    createdByMemberId: null,
    confirmed: false,
    version: 1,
    archived: false,
    archivedAt: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...encrypted,
    ...overrides,
  };
}

export function makeRawBoardMessage(
  id: string,
  overrides?: Partial<BoardMessageWire>,
): BoardMessageWire {
  const encrypted = encryptBoardMessageInput(
    { content: "Board post", senderId: brandId<MemberId>("m-1") },
    TEST_MASTER_KEY,
  );
  return {
    id,
    systemId: TEST_SYSTEM_ID,
    pinned: false,
    sortOrder: 0,
    version: 1,
    archived: false,
    archivedAt: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...encrypted,
    ...overrides,
  };
}

export function makeRawChannel(id: string, overrides?: Partial<ChannelWire>): ChannelWire {
  const encrypted = encryptChannelInput({ name: "general" }, TEST_MASTER_KEY);
  return {
    id,
    systemId: TEST_SYSTEM_ID,
    type: "channel",
    parentId: null,
    sortOrder: 0,
    version: 1,
    archived: false,
    archivedAt: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...encrypted,
    ...overrides,
  };
}

export function makeRawMessage(
  id: string,
  channelId: ChannelId = brandId<ChannelId>("ch-1"),
  overrides?: Partial<ChatMessageWire>,
): ChatMessageWire {
  const encrypted = encryptMessageInput(
    {
      content: "hello",
      attachments: [],
      mentions: [],
      senderId: brandId<MemberId>("m-1"),
    },
    TEST_MASTER_KEY,
  );
  return {
    id,
    channelId,
    systemId: TEST_SYSTEM_ID,
    replyToId: null,
    timestamp: NOW,
    editedAt: null,
    version: 1,
    archived: false,
    archivedAt: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...encrypted,
    ...overrides,
  };
}

export function makeRawPoll(id: string, overrides?: Partial<PollWire>): PollWire {
  const encrypted = encryptPollInput(
    {
      title: brandValue<PollTitle>(`Poll ${id}`),
      description: null,
      options: [
        {
          id: brandId<PollOptionId>("opt-1"),
          label: brandValue<PollOptionLabel>("Yes"),
          voteCount: 0,
          color: null,
          emoji: null,
        },
      ],
    },
    TEST_MASTER_KEY,
  );
  return {
    id,
    systemId: TEST_SYSTEM_ID,
    createdByMemberId: null,
    kind: "standard",
    status: "open",
    closedAt: null,
    endsAt: null,
    allowMultipleVotes: false,
    maxVotesPerMember: 1,
    allowAbstain: false,
    allowVeto: false,
    version: 1,
    archived: false,
    archivedAt: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...encrypted,
    ...overrides,
  };
}

export function makeRawPollVote(
  id: string,
  pollId: string,
  overrides?: Partial<PollVoteWire>,
): PollVoteWire {
  const encrypted = encryptPollVoteInput({ comment: "My comment" }, TEST_MASTER_KEY);
  return {
    id,
    systemId: TEST_SYSTEM_ID,
    pollId,
    optionId: "opt-1",
    voter: { entityType: "member" as const, entityId: "mem-voter" },
    isVeto: false,
    votedAt: NOW,
    version: 1,
    archived: false,
    archivedAt: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...encrypted,
    ...overrides,
  };
}
