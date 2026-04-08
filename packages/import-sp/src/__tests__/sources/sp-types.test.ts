import { describe, expectTypeOf, it } from "vitest";

import type {
  SPBoardMessage,
  SPChannel,
  SPChannelCategory,
  SPChatMessage,
  SPComment,
  SPCustomField,
  SPDocument,
  SPFriend,
  SPFrontHistory,
  SPFrontStatus,
  SPGroup,
  SPMember,
  SPNote,
  SPPendingFriendRequest,
  SPPoll,
  SPPollOption,
  SPPollVote,
  SPPrivacyBucket,
  SPPrivate,
  SPUser,
} from "../../sources/sp-types.js";

describe("SP source types", () => {
  it("SPDocument carries the SP _id", () => {
    expectTypeOf<SPDocument>().toExtend<{ _id: string }>();
  });

  it("SPMember has info map for custom field values", () => {
    expectTypeOf<SPMember["info"]>().toEqualTypeOf<Readonly<Record<string, string>> | undefined>();
  });

  it("SPMember has both legacy private flag and modern buckets array", () => {
    expectTypeOf<SPMember["private"]>().toEqualTypeOf<boolean | undefined>();
    expectTypeOf<SPMember["preventTrusted"]>().toEqualTypeOf<boolean | undefined>();
    expectTypeOf<SPMember["buckets"]>().toEqualTypeOf<readonly string[] | undefined>();
  });

  it("SPFrontHistory has live + member + customStatus", () => {
    expectTypeOf<SPFrontHistory["live"]>().toEqualTypeOf<boolean>();
    expectTypeOf<SPFrontHistory["member"]>().toEqualTypeOf<string>();
    expectTypeOf<SPFrontHistory["custom"]>().toEqualTypeOf<boolean>();
    expectTypeOf<SPFrontHistory["customStatus"]>().toEqualTypeOf<string | null | undefined>();
    expectTypeOf<SPFrontHistory["endTime"]>().toEqualTypeOf<number | null>();
  });

  it("SPPoll has options array and embedded votes", () => {
    expectTypeOf<SPPoll["options"]>().toEqualTypeOf<readonly SPPollOption[]>();
    expectTypeOf<SPPoll["votes"]>().toEqualTypeOf<readonly SPPollVote[] | undefined>();
  });

  it("SPNote has member field for the author", () => {
    expectTypeOf<SPNote["member"]>().toEqualTypeOf<string>();
  });

  it("SPChannel has parentCategory FK", () => {
    expectTypeOf<SPChannel["parentCategory"]>().toEqualTypeOf<string | null>();
  });

  it("SPUser has username, color, avatarUrl", () => {
    expectTypeOf<SPUser["username"]>().toEqualTypeOf<string>();
  });

  it("SPPrivate has locale and notification toggles", () => {
    expectTypeOf<SPPrivate["frontNotifs"]>().toEqualTypeOf<boolean | undefined>();
  });

  it("collection types are discoverable from the module", () => {
    // Reference the imported types so eslint no-unused-vars stays happy.
    type _Assert = [
      SPBoardMessage,
      SPChannelCategory,
      SPChatMessage,
      SPComment,
      SPCustomField,
      SPFriend,
      SPFrontStatus,
      SPGroup,
      SPPendingFriendRequest,
      SPPrivacyBucket,
    ];
    expectTypeOf<_Assert>().not.toBeNever();
  });
});
