import { describe, expectTypeOf, it } from "vitest";

import type {
  AcknowledgementRequest,
  ArchivedAcknowledgementRequest,
  ArchivedBoardMessage,
  ArchivedPoll,
  ArchivedPollVote,
  BoardMessage,
  Channel,
  ChatMessage,
  Note,
  Poll,
  PollOption,
  PollVote,
} from "../communication.js";
import type {
  AcknowledgementId,
  BlobId,
  BoardMessageId,
  ChannelId,
  HexColor,
  MemberId,
  MessageId,
  NoteId,
  PollId,
  PollOptionId,
  PollVoteId,
  SystemId,
} from "../ids.js";
import type { UnixMillis } from "../timestamps.js";
import type { AuditMetadata, EntityReference } from "../utility.js";

describe("Channel", () => {
  it("extends AuditMetadata", () => {
    expectTypeOf<Channel>().toExtend<AuditMetadata>();
  });

  it("has correct field types", () => {
    expectTypeOf<Channel["id"]>().toEqualTypeOf<ChannelId>();
    expectTypeOf<Channel["systemId"]>().toEqualTypeOf<SystemId>();
    expectTypeOf<Channel["name"]>().toBeString();
    expectTypeOf<Channel["type"]>().toEqualTypeOf<"category" | "channel">();
    expectTypeOf<Channel["parentId"]>().toEqualTypeOf<ChannelId | null>();
    expectTypeOf<Channel["sortOrder"]>().toEqualTypeOf<number>();
  });
});

describe("ChatMessage", () => {
  it("extends AuditMetadata", () => {
    expectTypeOf<ChatMessage>().toExtend<AuditMetadata>();
  });

  it("has correct field types", () => {
    expectTypeOf<ChatMessage["id"]>().toEqualTypeOf<MessageId>();
    expectTypeOf<ChatMessage["channelId"]>().toEqualTypeOf<ChannelId>();
    expectTypeOf<ChatMessage["systemId"]>().toEqualTypeOf<SystemId>();
    expectTypeOf<ChatMessage["senderId"]>().toEqualTypeOf<MemberId>();
    expectTypeOf<ChatMessage["content"]>().toBeString();
    expectTypeOf<ChatMessage["attachments"]>().toEqualTypeOf<readonly BlobId[]>();
    expectTypeOf<ChatMessage["mentions"]>().toEqualTypeOf<readonly MemberId[]>();
    expectTypeOf<ChatMessage["replyToId"]>().toEqualTypeOf<MessageId | null>();
    expectTypeOf<ChatMessage["timestamp"]>().toEqualTypeOf<UnixMillis>();
    expectTypeOf<ChatMessage["editedAt"]>().toEqualTypeOf<UnixMillis | null>();
  });
});

describe("BoardMessage", () => {
  it("extends AuditMetadata", () => {
    expectTypeOf<BoardMessage>().toExtend<AuditMetadata>();
  });

  it("has correct field types", () => {
    expectTypeOf<BoardMessage["id"]>().toEqualTypeOf<BoardMessageId>();
    expectTypeOf<BoardMessage["systemId"]>().toEqualTypeOf<SystemId>();
    expectTypeOf<BoardMessage["senderId"]>().toEqualTypeOf<MemberId>();
    expectTypeOf<BoardMessage["content"]>().toBeString();
    expectTypeOf<BoardMessage["pinned"]>().toEqualTypeOf<boolean>();
    expectTypeOf<BoardMessage["sortOrder"]>().toEqualTypeOf<number>();
  });

  it("has archived as false literal", () => {
    expectTypeOf<BoardMessage["archived"]>().toEqualTypeOf<false>();
  });
});

describe("ArchivedBoardMessage", () => {
  it("has archived as true literal", () => {
    expectTypeOf<ArchivedBoardMessage["archived"]>().toEqualTypeOf<true>();
  });

  it("has archivedAt timestamp", () => {
    expectTypeOf<ArchivedBoardMessage["archivedAt"]>().toEqualTypeOf<UnixMillis>();
  });

  it("preserves core BoardMessage fields", () => {
    expectTypeOf<ArchivedBoardMessage["id"]>().toEqualTypeOf<BoardMessageId>();
    expectTypeOf<ArchivedBoardMessage["systemId"]>().toEqualTypeOf<SystemId>();
  });
});

describe("Note", () => {
  it("extends AuditMetadata", () => {
    expectTypeOf<Note>().toExtend<AuditMetadata>();
  });

  it("has correct field types", () => {
    expectTypeOf<Note["id"]>().toEqualTypeOf<NoteId>();
    expectTypeOf<Note["systemId"]>().toEqualTypeOf<SystemId>();
    expectTypeOf<Note["memberId"]>().toEqualTypeOf<MemberId | null>();
    expectTypeOf<Note["title"]>().toBeString();
    expectTypeOf<Note["content"]>().toBeString();
    expectTypeOf<Note["backgroundColor"]>().toEqualTypeOf<HexColor | null>();
  });
});

describe("PollOption", () => {
  it("has exactly the expected keys", () => {
    expectTypeOf<keyof PollOption>().toEqualTypeOf<
      "id" | "label" | "voteCount" | "color" | "emoji"
    >();
  });

  it("has correct field types", () => {
    expectTypeOf<PollOption["id"]>().toEqualTypeOf<PollOptionId>();
    expectTypeOf<PollOption["label"]>().toBeString();
    expectTypeOf<PollOption["voteCount"]>().toEqualTypeOf<number>();
    expectTypeOf<PollOption["color"]>().toEqualTypeOf<HexColor | null>();
    expectTypeOf<PollOption["emoji"]>().toEqualTypeOf<string | null>();
  });
});

describe("Poll", () => {
  it("extends AuditMetadata", () => {
    expectTypeOf<Poll>().toExtend<AuditMetadata>();
  });

  it("has correct field types", () => {
    expectTypeOf<Poll["id"]>().toEqualTypeOf<PollId>();
    expectTypeOf<Poll["systemId"]>().toEqualTypeOf<SystemId>();
    expectTypeOf<Poll["createdByMemberId"]>().toEqualTypeOf<MemberId>();
    expectTypeOf<Poll["title"]>().toBeString();
    expectTypeOf<Poll["description"]>().toEqualTypeOf<string | null>();
    expectTypeOf<Poll["kind"]>().toEqualTypeOf<"standard" | "custom">();
    expectTypeOf<Poll["options"]>().toEqualTypeOf<readonly PollOption[]>();
    expectTypeOf<Poll["status"]>().toEqualTypeOf<"open" | "closed">();
    expectTypeOf<Poll["closedAt"]>().toEqualTypeOf<UnixMillis | null>();
    expectTypeOf<Poll["endsAt"]>().toEqualTypeOf<UnixMillis | null>();
    expectTypeOf<Poll["allowMultipleVotes"]>().toEqualTypeOf<boolean>();
    expectTypeOf<Poll["maxVotesPerMember"]>().toEqualTypeOf<number>();
    expectTypeOf<Poll["allowAbstain"]>().toEqualTypeOf<boolean>();
    expectTypeOf<Poll["allowVeto"]>().toEqualTypeOf<boolean>();
  });

  it("has archived as false literal", () => {
    expectTypeOf<Poll["archived"]>().toEqualTypeOf<false>();
  });
});

describe("ArchivedPoll", () => {
  it("has archived as true literal", () => {
    expectTypeOf<ArchivedPoll["archived"]>().toEqualTypeOf<true>();
  });

  it("has archivedAt timestamp", () => {
    expectTypeOf<ArchivedPoll["archivedAt"]>().toEqualTypeOf<UnixMillis>();
  });

  it("preserves core Poll fields", () => {
    expectTypeOf<ArchivedPoll["id"]>().toEqualTypeOf<PollId>();
    expectTypeOf<ArchivedPoll["systemId"]>().toEqualTypeOf<SystemId>();
  });
});

describe("PollVote", () => {
  it("does not extend AuditMetadata", () => {
    expectTypeOf<PollVote>().not.toExtend<AuditMetadata>();
  });

  it("has exactly the expected keys", () => {
    expectTypeOf<keyof PollVote>().toEqualTypeOf<
      "id" | "pollId" | "optionId" | "voter" | "comment" | "isVeto" | "votedAt" | "archived"
    >();
  });

  it("has correct field types", () => {
    expectTypeOf<PollVote["id"]>().toEqualTypeOf<PollVoteId>();
    expectTypeOf<PollVote["pollId"]>().toEqualTypeOf<PollId>();
    expectTypeOf<PollVote["optionId"]>().toEqualTypeOf<PollOptionId | null>();
    expectTypeOf<PollVote["voter"]>().toEqualTypeOf<
      EntityReference<"member" | "subsystem" | "side-system" | "layer">
    >();
    expectTypeOf<PollVote["comment"]>().toEqualTypeOf<string | null>();
    expectTypeOf<PollVote["isVeto"]>().toEqualTypeOf<boolean>();
    expectTypeOf<PollVote["votedAt"]>().toEqualTypeOf<UnixMillis>();
  });

  it("has archived as false literal", () => {
    expectTypeOf<PollVote["archived"]>().toEqualTypeOf<false>();
  });
});

describe("ArchivedPollVote", () => {
  it("has archived as true literal", () => {
    expectTypeOf<ArchivedPollVote["archived"]>().toEqualTypeOf<true>();
  });

  it("has archivedAt timestamp", () => {
    expectTypeOf<ArchivedPollVote["archivedAt"]>().toEqualTypeOf<UnixMillis>();
  });

  it("preserves core PollVote fields", () => {
    expectTypeOf<ArchivedPollVote["id"]>().toEqualTypeOf<PollVoteId>();
    expectTypeOf<ArchivedPollVote["pollId"]>().toEqualTypeOf<PollId>();
  });
});

describe("AcknowledgementRequest", () => {
  it("extends AuditMetadata", () => {
    expectTypeOf<AcknowledgementRequest>().toExtend<AuditMetadata>();
  });

  it("has correct field types", () => {
    expectTypeOf<AcknowledgementRequest["id"]>().toEqualTypeOf<AcknowledgementId>();
    expectTypeOf<AcknowledgementRequest["systemId"]>().toEqualTypeOf<SystemId>();
    expectTypeOf<AcknowledgementRequest["createdByMemberId"]>().toEqualTypeOf<MemberId>();
    expectTypeOf<AcknowledgementRequest["targetMemberId"]>().toEqualTypeOf<MemberId>();
    expectTypeOf<AcknowledgementRequest["message"]>().toBeString();
    expectTypeOf<AcknowledgementRequest["confirmed"]>().toEqualTypeOf<boolean>();
    expectTypeOf<AcknowledgementRequest["confirmedAt"]>().toEqualTypeOf<UnixMillis | null>();
  });

  it("has archived as false literal", () => {
    expectTypeOf<AcknowledgementRequest["archived"]>().toEqualTypeOf<false>();
  });
});

describe("ArchivedAcknowledgementRequest", () => {
  it("has archived as true literal", () => {
    expectTypeOf<ArchivedAcknowledgementRequest["archived"]>().toEqualTypeOf<true>();
  });

  it("has archivedAt timestamp", () => {
    expectTypeOf<ArchivedAcknowledgementRequest["archivedAt"]>().toEqualTypeOf<UnixMillis>();
  });

  it("preserves core AcknowledgementRequest fields", () => {
    expectTypeOf<ArchivedAcknowledgementRequest["id"]>().toEqualTypeOf<AcknowledgementId>();
    expectTypeOf<ArchivedAcknowledgementRequest["systemId"]>().toEqualTypeOf<SystemId>();
  });
});
