// scripts/sp-seed/fixtures/minimal.ts
import type { EntityFixtures } from "./types.js";
import {
  FIVE_MINUTES_MS,
  ONE_DAY_MS,
  ONE_HOUR_MS,
  TEN_MINUTES_MS,
  TWO_DAYS_MS,
  TWO_HOURS_MS,
  NINETY_MINUTES_MS,
  EIGHTY_MINUTES_MS,
} from "../constants.js";

/**
 * Minimal mode fixtures. Every ref must be unique and declared before it's
 * referenced by a downstream entity. 13 entity types populated; counts:
 * 2 buckets / 2 fields / 2 fronts / 3 members / 2 groups / 4 front history /
 * 2 comments / 2 notes / 2 polls / 1 category / 2 channels / 3 chat msgs / 2 board msgs.
 */
const now = Date.now();

export const MINIMAL_FIXTURES: EntityFixtures = {
  privacyBuckets: [
    {
      ref: "bucket.public",
      body: {
        name: "Public",
        desc: "Visible to everyone",
        color: "#00ff00",
        icon: "🌍",
        rank: "a00000",
      },
    },
    {
      ref: "bucket.closefriends",
      body: {
        name: "Close Friends",
        desc: "Trusted circle only",
        color: "#ff6600",
        icon: "🤝",
        rank: "a00001",
      },
    },
  ],

  customFields: [
    {
      ref: "field.pronouns",
      body: { name: "Pronouns", supportMarkdown: false, type: 0, order: "a00000" },
    },
    {
      ref: "field.favcolor",
      body: { name: "Favorite Color", supportMarkdown: true, type: 1, order: "a00001" },
    },
  ],

  customFronts: [
    { ref: "front.dissociated", body: { name: "Dissociated" } },
    { ref: "front.blurry", body: { name: "Blurry" } },
  ],

  members: [
    { ref: "member.alice", body: { name: "Alice" } },
    { ref: "member.bob", body: { name: "Bob" } },
    { ref: "member.charlie", body: { name: "Charlie" } },
  ],

  groups: [
    {
      ref: "group.core",
      body: {
        parent: "",
        color: "#3366ff",
        name: "Core Group",
        desc: "The core members",
        emoji: "🌟",
        members: ["member.alice", "member.bob"],
      },
    },
    {
      ref: "group.sub",
      body: {
        parent: "group.core",
        color: "#9933ff",
        name: "Sub Group",
        desc: "A nested group",
        emoji: "🔮",
        members: ["member.alice"],
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
      ref: "front-history.bob-live",
      body: {
        custom: false,
        live: true,
        startTime: now - TEN_MINUTES_MS,
        member: "member.bob",
      },
    },
    {
      ref: "front-history.dissociated-ended",
      body: {
        custom: true,
        live: false,
        startTime: now - NINETY_MINUTES_MS,
        endTime: now - EIGHTY_MINUTES_MS,
        member: "front.dissociated",
      },
    },
    {
      ref: "front-history.blurry-live",
      body: {
        custom: true,
        live: true,
        startTime: now - FIVE_MINUTES_MS,
        member: "front.blurry",
      },
    },
  ],

  comments: [
    {
      ref: "comment.grounded",
      body: {
        time: now - 3_500_000,
        text: "Felt grounded during this front",
        documentId: "front-history.alice-ended",
        collection: "frontHistory",
      },
    },
    {
      ref: "comment.moderate",
      body: {
        time: now - 3_400_000,
        text: "Energy was moderate",
        documentId: "front-history.alice-ended",
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
      ref: "note.observation",
      body: {
        title: "Observation",
        note: "Communication improving",
        color: "#66ccff",
        member: "member.bob",
        date: now - TWO_DAYS_MS,
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
        ],
      },
    },
    {
      ref: "poll.outside",
      body: {
        name: "Go outside today?",
        desc: "Simple yes/no",
        custom: false,
        endTime: now + ONE_DAY_MS,
      },
    },
  ],

  channelCategories: [
    { ref: "category.general", body: { name: "General", desc: "General discussion" } },
  ],

  channels: [
    {
      ref: "channel.dailycheckin",
      body: {
        name: "daily-check-in",
        desc: "Daily check-ins",
        category: "category.general",
      },
    },
    {
      ref: "channel.random",
      body: { name: "random", desc: "Off-topic chat" },
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
      ref: "board.reminder",
      body: {
        title: "Reminder",
        message: "Remember to journal today",
        writtenBy: "member.bob",
        writtenFor: "member.alice",
        read: false,
        writtenAt: now - 4_000_000,
        supportMarkdown: true,
      },
    },
  ],

  profilePatch: { desc: "Minimal test system", color: "#4488ff" },
};
