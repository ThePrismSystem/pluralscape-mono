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
  BoardMessageId,
  ChannelId,
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
    expectTypeOf<Channel["description"]>().toEqualTypeOf<string | null>();
    expectTypeOf<Channel["archived"]>().toEqualTypeOf<false>();
  });
});

describe("ChatMessage", () => {
  it("extends AuditMetadata", () => {
    expectTypeOf<ChatMessage>().toExtend<AuditMetadata>();
  });

  it("has correct field types", () => {
    expectTypeOf<ChatMessage["id"]>().toEqualTypeOf<MessageId>();
    expectTypeOf<ChatMessage["channelId"]>().toEqualTypeOf<ChannelId>();
    expectTypeOf<ChatMessage["authorMemberId"]>().toEqualTypeOf<MemberId>();
    expectTypeOf<ChatMessage["content"]>().toBeString();
    expectTypeOf<ChatMessage["editedAt"]>().toEqualTypeOf<UnixMillis | null>();
  });
});

describe("BoardMessage", () => {
  it("extends AuditMetadata", () => {
    expectTypeOf<BoardMessage>().toExtend<AuditMetadata>();
  });

  it("has correct field types", () => {
    expectTypeOf<BoardMessage["id"]>().toEqualTypeOf<BoardMessageId>();
    expectTypeOf<BoardMessage["title"]>().toBeString();
    expectTypeOf<BoardMessage["pinned"]>().toEqualTypeOf<boolean>();
  });
});

describe("Note", () => {
  it("extends AuditMetadata", () => {
    expectTypeOf<Note>().toExtend<AuditMetadata>();
  });

  it("has correct field types", () => {
    expectTypeOf<Note["id"]>().toEqualTypeOf<NoteId>();
    expectTypeOf<Note["authorMemberId"]>().toEqualTypeOf<MemberId>();
    expectTypeOf<Note["title"]>().toBeString();
    expectTypeOf<Note["content"]>().toBeString();
  });
});

describe("PollOption", () => {
  it("has correct field types", () => {
    expectTypeOf<PollOption["id"]>().toEqualTypeOf<PollOptionId>();
    expectTypeOf<PollOption["pollId"]>().toEqualTypeOf<PollId>();
    expectTypeOf<PollOption["label"]>().toBeString();
    expectTypeOf<PollOption["sortOrder"]>().toEqualTypeOf<number>();
  });
});

describe("Poll", () => {
  it("extends AuditMetadata", () => {
    expectTypeOf<Poll>().toExtend<AuditMetadata>();
  });

  it("has correct field types", () => {
    expectTypeOf<Poll["id"]>().toEqualTypeOf<PollId>();
    expectTypeOf<Poll["question"]>().toBeString();
    expectTypeOf<Poll["options"]>().toEqualTypeOf<readonly PollOption[]>();
    expectTypeOf<Poll["multipleChoice"]>().toEqualTypeOf<boolean>();
    expectTypeOf<Poll["closedAt"]>().toEqualTypeOf<UnixMillis | null>();
  });
});

describe("PollVote", () => {
  it("does not extend AuditMetadata", () => {
    expectTypeOf<PollVote>().not.toExtend<AuditMetadata>();
  });

  it("has correct field types", () => {
    expectTypeOf<PollVote["id"]>().toEqualTypeOf<PollVoteId>();
    expectTypeOf<PollVote["pollId"]>().toEqualTypeOf<PollId>();
    expectTypeOf<PollVote["optionId"]>().toEqualTypeOf<PollOptionId>();
    expectTypeOf<PollVote["memberId"]>().toEqualTypeOf<MemberId>();
    expectTypeOf<PollVote["createdAt"]>().toEqualTypeOf<UnixMillis>();
  });
});

describe("AcknowledgementRequest", () => {
  it("extends AuditMetadata", () => {
    expectTypeOf<AcknowledgementRequest>().toExtend<AuditMetadata>();
  });

  it("has correct field types", () => {
    expectTypeOf<AcknowledgementRequest["id"]>().toEqualTypeOf<AcknowledgementId>();
    expectTypeOf<AcknowledgementRequest["requestedByMemberId"]>().toEqualTypeOf<MemberId>();
    expectTypeOf<AcknowledgementRequest["targetMemberIds"]>().toEqualTypeOf<readonly MemberId[]>();
    expectTypeOf<AcknowledgementRequest["acknowledgedByMemberIds"]>().toEqualTypeOf<
      readonly MemberId[]
    >();
    expectTypeOf<AcknowledgementRequest["message"]>().toBeString();
  });
});
