// scripts/sp-seed/fixtures/adversarial.ts
import type { EntityFixtures } from "./types.js";
import {
  TWO_MINUTES_MS,
  FIVE_MINUTES_MS,
  ONE_DAY_MS,
  ONE_HOUR_MS,
  TWO_DAYS_MS,
  THREE_DAYS_MS,
  FOUR_DAYS_MS,
  TWO_HOURS_MS,
  THIRTY_DAYS_MS,
} from "../constants.js";

const now = Date.now();

/**
 * Adversarial mode fixtures — Unicode, empty strings, boundaries, edge cases.
 * Counts: 3 buckets / 4 fields / 3 fronts / 5 members / 3 groups / 6 front history /
 * 4 comments / 4 notes / 3 polls / 2 categories / 3 channels / 5 chat msgs / 3 board msgs.
 */
export const ADVERSARIAL_FIXTURES: EntityFixtures = {
  privacyBuckets: [
    {
      ref: "bucket.public",
      body: {
        name: "Public",
        desc: "Everyone can see",
        color: "#00ff00",
        icon: "🌍",
        rank: "a00000",
      },
    },
    {
      ref: "bucket.pride",
      body: {
        name: "\u{1F308}\u{1F3F3}\u{FE0F}\u200D\u{1F308} Pride",
        desc: "",
        color: "#ff00ff",
        icon: "\u{1F3F3}\u{FE0F}\u200D\u{1F308}",
        rank: "a00001",
      },
    },
    {
      ref: "bucket.cjk",
      body: {
        name: "\u6D4B\u8BD5\u79C1\u5BC6",
        desc: "Chinese characters in name",
        color: "#333333",
        icon: "\u{1F512}",
        rank: "a00002",
      },
    },
  ],

  customFields: [
    {
      ref: "field.pronouns",
      body: { name: "Pronouns", supportMarkdown: false, type: 0, order: "a00000" },
    },
    {
      ref: "field.role",
      body: { name: "Role", supportMarkdown: false, type: 1, order: "a00001" },
    },
    {
      ref: "field.desc",
      body: { name: "Description", supportMarkdown: true, type: 2, order: "a00002" },
    },
    {
      ref: "field.artstyle",
      body: {
        name: "\u{1F3A8} Art Style",
        supportMarkdown: true,
        type: 3,
        order: "a00003",
      },
    },
  ],

  customFronts: [
    { ref: "front.dissociated", body: { name: "Dissociated" } },
    { ref: "front.blurry", body: { name: "Blurry" } },
    { ref: "front.zws", body: { name: "\u200B" } },
  ],

  members: [
    { ref: "member.alice", body: { name: "Alice" } },
    { ref: "member.bob", body: { name: "Bob" } },
    { ref: "member.elise", body: { name: "\u00C9lise" } },
    { ref: "member.xiaoming", body: { name: "\u5C0F\u660E" } },
    { ref: "member.archived", body: { name: "Archived-Test" } },
  ],

  groups: [
    {
      ref: "group.root",
      body: {
        parent: "",
        color: "#3366ff",
        name: "Root Group",
        desc: "Top-level group",
        emoji: "🌟",
        members: ["member.alice", "member.bob"],
      },
    },
    {
      ref: "group.mid",
      body: {
        parent: "group.root",
        color: "#9933ff",
        name: "Mid Group",
        desc: "Nested under root",
        emoji: "🔮",
        members: ["member.alice", "member.elise"],
      },
    },
    {
      ref: "group.empty",
      body: {
        parent: "group.mid",
        color: "#cc0000",
        name: "Empty Leaf",
        desc: "Group with no members",
        emoji: "🍂",
        members: [],
      },
    },
  ],

  frontHistory: [
    {
      ref: "front-history.alice-ended",
      body: {
        custom: false,
        live: false,
        startTime: now - TWO_HOURS_MS,
        endTime: now - ONE_HOUR_MS,
        member: "member.alice",
      },
    },
    {
      ref: "front-history.bob-zero",
      body: {
        custom: false,
        live: false,
        startTime: now - 5_000_000,
        endTime: now - 5_000_000,
        member: "member.bob",
      },
    },
    {
      ref: "front-history.elise-old",
      body: {
        custom: false,
        live: false,
        startTime: now - THIRTY_DAYS_MS,
        endTime: now - 2_591_000_000,
        member: "member.elise",
      },
    },
    {
      ref: "front-history.xiaoming-live",
      body: {
        custom: false,
        live: true,
        startTime: now - FIVE_MINUTES_MS,
        member: "member.xiaoming",
      },
    },
    {
      ref: "front-history.dissociated-ended",
      body: {
        custom: true,
        live: false,
        startTime: now - 4_000_000,
        endTime: now - 3_500_000,
        member: "front.dissociated",
      },
    },
    {
      ref: "front-history.blurry-live",
      body: {
        custom: true,
        live: true,
        startTime: now - TWO_MINUTES_MS,
        member: "front.blurry",
      },
    },
  ],

  comments: [
    {
      ref: "comment.normal",
      body: {
        time: now - 3_500_000,
        text: "Normal comment",
        documentId: "front-history.alice-ended",
        collection: "frontHistory",
      },
    },
    {
      ref: "comment.empty",
      body: {
        time: now - 3_400_000,
        text: "",
        documentId: "front-history.alice-ended",
        collection: "frontHistory",
      },
    },
    {
      ref: "comment.long",
      body: {
        time: now - 2_590_000_000,
        text: "A".repeat(500),
        documentId: "front-history.elise-old",
        collection: "frontHistory",
      },
    },
    {
      ref: "comment.unicode",
      body: {
        time: now - 2_589_000_000,
        text: "\u{1F4DD} \u65E5\u672C\u8A9E\u30C6\u30B9\u30C8 \u{1F30F}",
        documentId: "front-history.elise-old",
        collection: "frontHistory",
      },
    },
  ],

  notes: [
    {
      ref: "note.recap",
      body: {
        title: "Session recap",
        note: "Today was productive",
        color: "#ffcc00",
        member: "member.alice",
        date: now - ONE_DAY_MS,
      },
    },
    {
      ref: "note.emptytitle",
      body: {
        title: "",
        note: "Note with empty title",
        color: "#ff0000",
        member: "member.bob",
        date: now - TWO_DAYS_MS,
      },
    },
    {
      ref: "note.markdown",
      body: {
        title: "Markdown note",
        note: "# Heading\n\n- item 1\n- item 2\n\n**bold** and *italic*",
        color: "#66ccff",
        member: "member.elise",
        date: now - THREE_DAYS_MS,
      },
    },
    {
      ref: "note.long",
      body: {
        title: "Long note",
        note: "Lorem ipsum ".repeat(200).trim(),
        color: "#cccccc",
        member: "member.xiaoming",
        date: now - FOUR_DAYS_MS,
      },
    },
  ],

  polls: [
    {
      ref: "poll.snack",
      body: {
        name: "Favorite snack",
        desc: "What should we eat?",
        custom: true,
        endTime: now + ONE_DAY_MS,
        options: [
          { name: "Chips", color: "#ffaa00" },
          { name: "Fruit", color: "#00cc66" },
          { name: "Veto", color: "#ff0000" },
        ],
      },
    },
    {
      ref: "poll.unicode",
      body: {
        name: "\u{1F4CA} \u6295\u7968",
        desc: "Unicode poll name",
        custom: true,
        endTime: now + TWO_DAYS_MS,
        options: [
          { name: "\u306F\u3044", color: "#00ff00" },
          { name: "\u3044\u3044\u3048", color: "#ff0000" },
        ],
      },
    },
    {
      ref: "poll.outside",
      body: {
        name: "Go outside today?",
        desc: "Simple yes/no vote",
        custom: false,
        endTime: now + ONE_DAY_MS,
      },
    },
  ],

  channels: [
    {
      ref: "channel.dailycheckin",
      body: { name: "daily-check-in", desc: "Daily check-ins" },
    },
    {
      ref: "channel.gametalk",
      body: { name: "game-talk", desc: "Talk about games" },
    },
    {
      ref: "channel.orphan",
      body: { name: "orphan-channel", desc: "No category assigned" },
    },
  ],

  channelCategories: [
    {
      ref: "category.general",
      body: {
        name: "General",
        desc: "General discussion",
        channels: ["channel.dailycheckin"],
      },
    },
    {
      ref: "category.gaming",
      body: {
        name: "\u{1F3AE} Gaming",
        desc: "Gaming channels",
        channels: ["channel.gametalk"],
      },
    },
  ],

  chatMessages: [
    {
      ref: "chat.morning",
      body: {
        message: "Good morning everyone",
        channel: "channel.dailycheckin",
        writer: "member.alice",
        writtenAt: now - 7_000_000,
      },
    },
    {
      ref: "chat.hi",
      body: {
        message: "Hi Alice!",
        channel: "channel.dailycheckin",
        writer: "member.bob",
        writtenAt: now - 6_900_000,
      },
    },
    {
      ref: "chat.feeling",
      body: {
        message: "How is everyone feeling?",
        channel: "channel.dailycheckin",
        writer: "member.alice",
        writtenAt: now - 6_800_000,
      },
    },
    {
      ref: "chat.ohayou",
      body: {
        message: "\u304A\u306F\u3088\u3046\u3054\u3056\u3044\u307E\u3059",
        channel: "channel.gametalk",
        writer: "member.elise",
        writtenAt: now - 5_000_000,
      },
    },
    {
      ref: "chat.nihao",
      body: {
        message: "\u{1F44B} \u4F60\u597D!",
        channel: "channel.gametalk",
        writer: "member.xiaoming",
        writtenAt: now - 4_900_000,
      },
    },
  ],

  boardMessages: [
    {
      ref: "board.welcome",
      body: {
        title: "Welcome note",
        message: "Welcome to the system board!",
        writtenBy: "member.alice",
        writtenFor: "member.bob",
        read: false,
        writtenAt: now - 5_000_000,
        supportMarkdown: false,
      },
    },
    {
      ref: "board.long",
      body: {
        title: "A".repeat(70),
        message: "Testing max title length boundary",
        writtenBy: "member.bob",
        writtenFor: "member.alice",
        read: true,
        writtenAt: now - 4_000_000,
        supportMarkdown: false,
      },
    },
    {
      ref: "board.unicode",
      body: {
        title: "\u{1F4E8} Message",
        message:
          "\u{1F30D} \u4E16\u754C\u5404\u5730\u304B\u3089\u306E\u30E1\u30C3\u30BB\u30FC\u30B8",
        writtenBy: "member.elise",
        writtenFor: "member.xiaoming",
        read: false,
        writtenAt: now - 3_000_000,
        supportMarkdown: true,
      },
    },
  ],

  profilePatch: {
    desc: "\u{1F308} Adversarial test system \u6D4B\u8BD5",
    color: "#ff00ff",
  },
};
