import { describe, expectTypeOf, it } from "vitest";

import type {
  AcknowledgementRequest,
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
import type { AuditMetadata } from "../utility.js";

describe("Channel", () => {
  it("extends AuditMetadata", () => {
    expectTypeOf<Channel>().toExtend<AuditMetadata>();
  });

  it("has correct field types", () => {
    expectTypeOf<Channel["id"]>().toEqualTypeOf<ChannelId>();
    expectTypeOf<Channel["systemId"]>().toEqualTypeOf<SystemId>();
    expectTypeOf<Channel["name"]>().toBeString();
    expectTypeOf<Channel["type"]>().toEqualTypeOf<"category" | "channel">();
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
    expectTypeOf<BoardMessage["content"]>().toBeString();
    expectTypeOf<BoardMessage["pinned"]>().toEqualTypeOf<boolean>();
    expectTypeOf<BoardMessage["sortOrder"]>().toEqualTypeOf<number>();
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
    expectTypeOf<keyof PollOption>().toEqualTypeOf<"id" | "label" | "voteCount">();
  });

  it("has correct field types", () => {
    expectTypeOf<PollOption["id"]>().toEqualTypeOf<PollOptionId>();
    expectTypeOf<PollOption["label"]>().toBeString();
    expectTypeOf<PollOption["voteCount"]>().toEqualTypeOf<number>();
  });
});

describe("Poll", () => {
  it("extends AuditMetadata", () => {
    expectTypeOf<Poll>().toExtend<AuditMetadata>();
  });

  it("has correct field types", () => {
    expectTypeOf<Poll["id"]>().toEqualTypeOf<PollId>();
    expectTypeOf<Poll["systemId"]>().toEqualTypeOf<SystemId>();
    expectTypeOf<Poll["title"]>().toBeString();
    expectTypeOf<Poll["options"]>().toEqualTypeOf<readonly PollOption[]>();
    expectTypeOf<Poll["status"]>().toEqualTypeOf<"open" | "closed">();
    expectTypeOf<Poll["closedAt"]>().toEqualTypeOf<UnixMillis | null>();
  });
});

describe("PollVote", () => {
  it("does not extend AuditMetadata", () => {
    expectTypeOf<PollVote>().not.toExtend<AuditMetadata>();
  });

  it("has exactly the expected keys", () => {
    expectTypeOf<keyof PollVote>().toEqualTypeOf<
      "id" | "pollId" | "optionId" | "memberId" | "votedAt"
    >();
  });

  it("has correct field types", () => {
    expectTypeOf<PollVote["id"]>().toEqualTypeOf<PollVoteId>();
    expectTypeOf<PollVote["pollId"]>().toEqualTypeOf<PollId>();
    expectTypeOf<PollVote["optionId"]>().toEqualTypeOf<PollOptionId>();
    expectTypeOf<PollVote["memberId"]>().toEqualTypeOf<MemberId>();
    expectTypeOf<PollVote["votedAt"]>().toEqualTypeOf<UnixMillis>();
  });
});

describe("AcknowledgementRequest", () => {
  it("extends AuditMetadata", () => {
    expectTypeOf<AcknowledgementRequest>().toExtend<AuditMetadata>();
  });

  it("has correct field types", () => {
    expectTypeOf<AcknowledgementRequest["id"]>().toEqualTypeOf<AcknowledgementId>();
    expectTypeOf<AcknowledgementRequest["systemId"]>().toEqualTypeOf<SystemId>();
    expectTypeOf<AcknowledgementRequest["targetMemberId"]>().toEqualTypeOf<MemberId>();
    expectTypeOf<AcknowledgementRequest["message"]>().toBeString();
    expectTypeOf<AcknowledgementRequest["confirmed"]>().toEqualTypeOf<boolean>();
    expectTypeOf<AcknowledgementRequest["confirmedAt"]>().toEqualTypeOf<UnixMillis | null>();
  });
});
