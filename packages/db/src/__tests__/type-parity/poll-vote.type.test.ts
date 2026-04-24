/**
 * Drizzle parity check: the PollVote row shape inferred from the
 * `poll_votes` table structurally matches `PollVoteServerMetadata` in
 * @pluralscape/types.
 *
 * Hybrid entity with polymorphic voter: plaintext (`pollId`, `optionId`,
 * `voter` jsonb, `isVeto`, `votedAt`) + opaque `encryptedData`.
 */

import { describe, expectTypeOf, it } from "vitest";

import { pollVotes } from "../../schema/pg/communication.js";

import type { Equal, PollVoteServerMetadata } from "@pluralscape/types";
import type { InferSelectModel } from "drizzle-orm";

describe("PollVote Drizzle parity", () => {
  it("pollVotes Drizzle row has the same property keys as PollVoteServerMetadata", () => {
    type Row = InferSelectModel<typeof pollVotes>;
    expectTypeOf<keyof Row>().toEqualTypeOf<keyof PollVoteServerMetadata>();
  });

  it("pollVotes Drizzle row equals PollVoteServerMetadata", () => {
    type Row = InferSelectModel<typeof pollVotes>;
    expectTypeOf<Equal<Row, PollVoteServerMetadata>>().toEqualTypeOf<true>();
  });
});
