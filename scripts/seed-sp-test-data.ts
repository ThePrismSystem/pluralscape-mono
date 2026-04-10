/**
 * SP Test Data Seeding Script
 *
 * Seeds two Simply Plural accounts (minimal + adversarial) with known entity
 * data for E2E testing of the import engine. Writes credential env files and
 * manifest JSON files for downstream test consumption.
 *
 * Usage: pnpm seed:sp-test <minimal-email> <adversarial-email>
 */

import { writeFileSync } from "node:fs";
import process from "node:process";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SP_BASE_URL = "https://api.apparyllis.com";
const SP_PASSWORD = "TestImport1!sp";
const REQUEST_DELAY_MS = 350;
const ENTITY_CREATION_DELAY_MS = 500;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ManifestEntry {
  sourceId: string;
  fields: Record<string, unknown>;
}

interface Manifest {
  systemId: string;
  mode: string;
  privacyBuckets: ManifestEntry[];
  customFields: ManifestEntry[];
  customFronts: ManifestEntry[];
  members: ManifestEntry[];
  groups: ManifestEntry[];
  frontHistory: ManifestEntry[];
  comments: ManifestEntry[];
  notes: ManifestEntry[];
  polls: ManifestEntry[];
  channelCategories: ManifestEntry[];
  channels: ManifestEntry[];
  chatMessages: ManifestEntry[];
  boardMessages: ManifestEntry[];
}

type SpMode = "minimal" | "adversarial";

// ---------------------------------------------------------------------------
// API helpers
// ---------------------------------------------------------------------------

async function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function spFetch(
  path: string,
  options: {
    method?: string;
    token?: string;
    body?: Record<string, unknown>;
  } = {},
): Promise<unknown> {
  const { method = "GET", token, body } = options;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const url = `${SP_BASE_URL}${path}`;
  const response = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`SP API ${method} ${path} failed (${response.status}): ${text}`);
  }

  const text = await response.text();
  if (!text) return {};

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return { rawBody: text };
  }
}

function extractId(response: unknown): string | null {
  if (typeof response === "string") return response;
  if (typeof response !== "object" || response === null) return null;

  const obj = response as Record<string, unknown>;
  if (typeof obj["id"] === "string") return obj["id"];
  if (typeof obj["_id"] === "string") return obj["_id"];
  if (typeof obj["insertId"] === "string") return obj["insertId"];
  if (typeof obj["insertedId"] === "string") return obj["insertedId"];

  // Check nested insertedId (MongoDB style)
  if (
    typeof obj["insertedId"] === "object" &&
    obj["insertedId"] !== null &&
    typeof (obj["insertedId"] as Record<string, unknown>)["$oid"] === "string"
  ) {
    return (obj["insertedId"] as Record<string, unknown>)["$oid"] as string;
  }

  return null;
}

async function createEntity(
  path: string,
  body: Record<string, unknown>,
  token: string,
  label: string,
): Promise<string> {
  await delay(REQUEST_DELAY_MS);
  const response = await spFetch(path, { method: "POST", token, body });
  const id = extractId(response);
  if (id) return id;

  // Fallback: try to find the entity via GET on the collection
  // Strip trailing segments after the last slash if it's an ID param
  const collectionPath = path.replace(/\/:[^/]+\??$/, "");
  await delay(REQUEST_DELAY_MS);
  const collection = await spFetch(collectionPath, { token });

  if (Array.isArray(collection)) {
    // Find by matching body fields
    const match = collection.find((item: unknown) => {
      if (typeof item !== "object" || item === null) return false;
      const rec = item as Record<string, unknown>;
      return Object.entries(body).every(([key, value]) => rec[key] === value);
    });
    if (match && typeof match === "object") {
      const matchRec = match as Record<string, unknown>;
      const matchId = (matchRec["_id"] ?? matchRec["id"]) as string | undefined;
      if (matchId) return matchId;
    }
  }

  throw new Error(`Failed to extract ID for ${label} from response: ${JSON.stringify(response)}`);
}

// ---------------------------------------------------------------------------
// Account setup
// ---------------------------------------------------------------------------

async function registerAndLogin(email: string): Promise<{ token: string; systemId: string }> {
  console.log(`  Registering ${email}...`);
  await spFetch("/v1/auth/register", {
    method: "POST",
    body: { email, password: SP_PASSWORD },
  });

  await delay(ENTITY_CREATION_DELAY_MS);

  console.log(`  Logging in...`);
  const loginResponse = await spFetch("/v1/auth/login", {
    method: "POST",
    body: { email, password: SP_PASSWORD },
  });
  const loginObj = loginResponse as Record<string, unknown>;
  const token = loginObj["token"] as string;
  if (!token) {
    throw new Error(`Login failed — no token in response: ${JSON.stringify(loginResponse)}`);
  }

  await delay(REQUEST_DELAY_MS);

  console.log(`  Fetching system ID...`);
  const meResponse = await spFetch("/v1/me", { token });
  const meObj = meResponse as Record<string, unknown>;
  const systemId = (meObj["id"] ?? meObj["_id"] ?? meObj["uid"]) as string;
  if (!systemId) {
    throw new Error(`Could not extract system ID from /v1/me: ${JSON.stringify(meResponse)}`);
  }

  // Accept ToS
  await delay(REQUEST_DELAY_MS);
  await spFetch(`/v1/private/${systemId}`, {
    method: "PATCH",
    token,
    body: { termsOfServiceAccepted: true },
  });

  return { token, systemId };
}

// ---------------------------------------------------------------------------
// Minimal mode entity creation
// ---------------------------------------------------------------------------

async function seedMinimal(token: string, systemId: string): Promise<Manifest> {
  const manifest: Manifest = {
    systemId,
    mode: "minimal",
    privacyBuckets: [],
    customFields: [],
    customFronts: [],
    members: [],
    groups: [],
    frontHistory: [],
    comments: [],
    notes: [],
    polls: [],
    channelCategories: [],
    channels: [],
    chatMessages: [],
    boardMessages: [],
  };

  // --- Privacy buckets (2) ---
  console.log("  Creating privacy buckets...");
  for (const bucket of [
    { name: "Public", desc: "Visible to everyone", color: "#00ff00", icon: "🌍", rank: "a0" },
    {
      name: "Close Friends",
      desc: "Trusted circle only",
      color: "#ff6600",
      icon: "🤝",
      rank: "a1",
    },
  ]) {
    const id = await createEntity(
      "/v1/privacyBucket",
      bucket,
      token,
      `privacyBucket:${bucket.name}`,
    );
    manifest.privacyBuckets.push({ sourceId: id, fields: bucket });
  }

  // --- Custom fields (2, different types) ---
  console.log("  Creating custom fields...");
  for (const field of [
    { name: "Pronouns", supportMarkdown: false, type: 0, order: "a0" },
    { name: "Favorite Color", supportMarkdown: true, type: 1, order: "a1" },
  ]) {
    const id = await createEntity("/v1/customField", field, token, `customField:${field.name}`);
    manifest.customFields.push({ sourceId: id, fields: field });
  }

  // --- Custom fronts (2) ---
  console.log("  Creating custom fronts...");
  for (const front of [{ name: "Dissociated" }, { name: "Blurry" }]) {
    const id = await createEntity("/v1/customFront", front, token, `customFront:${front.name}`);
    manifest.customFronts.push({ sourceId: id, fields: front });
  }

  // --- Members (3) ---
  console.log("  Creating members...");
  for (const member of [{ name: "Alice" }, { name: "Bob" }, { name: "Charlie" }]) {
    const id = await createEntity("/v1/member", member, token, `member:${member.name}`);
    manifest.members.push({ sourceId: id, fields: member });
  }

  // --- Groups (2, one nested) ---
  console.log("  Creating groups...");
  const aliceId = manifest.members[0]!.sourceId;
  const bobId = manifest.members[1]!.sourceId;

  const parentGroupFields = {
    parent: "",
    color: "#3366ff",
    name: "Core Group",
    desc: "The core members",
    emoji: "🌟",
    members: [aliceId, bobId],
  };
  const parentGroupId = await createEntity(
    "/v1/group",
    parentGroupFields,
    token,
    "group:Core Group",
  );
  manifest.groups.push({ sourceId: parentGroupId, fields: parentGroupFields });

  const childGroupFields = {
    parent: parentGroupId,
    color: "#9933ff",
    name: "Sub Group",
    desc: "A nested group",
    emoji: "🔮",
    members: [aliceId],
  };
  const childGroupId = await createEntity("/v1/group", childGroupFields, token, "group:Sub Group");
  manifest.groups.push({ sourceId: childGroupId, fields: childGroupFields });

  // --- Front history (4: member live, member ended, custom live, custom ended) ---
  console.log("  Creating front history...");
  const now = Date.now();
  const customFrontId0 = manifest.customFronts[0]!.sourceId;
  const customFrontId1 = manifest.customFronts[1]!.sourceId;

  const frontEntries = [
    {
      custom: false,
      live: false,
      startTime: now - 7200000,
      endTime: now - 3600000,
      member: aliceId,
    },
    { custom: false, live: true, startTime: now - 600000, member: bobId },
    {
      custom: true,
      live: false,
      startTime: now - 5400000,
      endTime: now - 4800000,
      member: customFrontId0,
    },
    { custom: true, live: true, startTime: now - 300000, member: customFrontId1 },
  ];

  for (const entry of frontEntries) {
    const body: Record<string, unknown> = {
      custom: entry.custom,
      live: entry.live,
      startTime: entry.startTime,
      member: entry.member,
    };
    if ("endTime" in entry) {
      body["endTime"] = entry.endTime;
    }
    const label = `frontHistory:${entry.custom ? "custom" : "member"}:${entry.live ? "live" : "ended"}`;
    const id = await createEntity("/v1/frontHistory", body, token, label);
    manifest.frontHistory.push({ sourceId: id, fields: body });
  }

  // --- Comments (2) ---
  console.log("  Creating comments...");
  const frontHistId0 = manifest.frontHistory[0]!.sourceId;

  for (const comment of [
    {
      time: now - 3500000,
      text: "Felt grounded during this front",
      documentId: frontHistId0,
      collection: "frontHistory",
    },
    {
      time: now - 3400000,
      text: "Energy was moderate",
      documentId: frontHistId0,
      collection: "frontHistory",
    },
  ]) {
    const id = await createEntity(
      "/v1/comment",
      comment,
      token,
      `comment:${comment.text.slice(0, 20)}`,
    );
    manifest.comments.push({ sourceId: id, fields: comment });
  }

  // --- Notes (2) ---
  console.log("  Creating notes...");
  for (const note of [
    {
      title: "Session recap",
      note: "Today was productive",
      color: "#ffcc00",
      member: aliceId,
      date: now - 86400000,
    },
    {
      title: "Observation",
      note: "Communication improving",
      color: "#66ccff",
      member: bobId,
      date: now - 172800000,
    },
  ]) {
    const id = await createEntity("/v1/note", note, token, `note:${note.title}`);
    manifest.notes.push({ sourceId: id, fields: note });
  }

  // --- Polls (2: custom + standard) ---
  console.log("  Creating polls...");
  const customPollFields = {
    name: "Favorite snack",
    desc: "What should we eat?",
    custom: true,
    endTime: now + 86400000,
    options: [
      { name: "Chips", color: "#ffaa00" },
      { name: "Fruit", color: "#00cc66" },
    ],
  };
  const customPollId = await createEntity(
    "/v1/poll",
    customPollFields,
    token,
    "poll:Favorite snack",
  );
  manifest.polls.push({ sourceId: customPollId, fields: customPollFields });

  const standardPollFields = {
    name: "Go outside today?",
    desc: "Simple yes/no",
    custom: false,
    endTime: now + 86400000,
  };
  const standardPollId = await createEntity(
    "/v1/poll",
    standardPollFields,
    token,
    "poll:Go outside",
  );
  manifest.polls.push({ sourceId: standardPollId, fields: standardPollFields });

  // --- Channel categories (1) ---
  console.log("  Creating channel categories...");
  const catFields = { name: "General", desc: "General discussion" };
  const catId = await createEntity(
    "/v1/chat/category",
    catFields,
    token,
    "channelCategory:General",
  );
  manifest.channelCategories.push({ sourceId: catId, fields: catFields });

  // --- Channels (2) ---
  console.log("  Creating channels...");
  for (const channel of [
    { name: "daily-check-in", desc: "Daily check-ins", category: catId },
    { name: "random", desc: "Off-topic chat" },
  ]) {
    const id = await createEntity("/v1/chat/channel", channel, token, `channel:${channel.name}`);
    manifest.channels.push({ sourceId: id, fields: channel });
  }

  // --- Chat messages (3) ---
  console.log("  Creating chat messages...");
  const channelId0 = manifest.channels[0]!.sourceId;

  for (const msg of [
    {
      message: "Good morning everyone",
      channel: channelId0,
      writer: aliceId,
      writtenAt: now - 7000000,
    },
    { message: "Hi Alice!", channel: channelId0, writer: bobId, writtenAt: now - 6900000 },
    {
      message: "How is everyone feeling?",
      channel: channelId0,
      writer: aliceId,
      writtenAt: now - 6800000,
    },
  ]) {
    const id = await createEntity(
      "/v1/chat/message",
      msg,
      token,
      `chatMessage:${msg.message.slice(0, 20)}`,
    );
    manifest.chatMessages.push({ sourceId: id, fields: msg });
  }

  // --- Board messages (2) ---
  console.log("  Creating board messages...");
  for (const board of [
    {
      title: "Welcome note",
      message: "Welcome to the system board!",
      writtenBy: aliceId,
      writtenFor: bobId,
      read: false,
      writtenAt: now - 5000000,
      supportMarkdown: false,
    },
    {
      title: "Reminder",
      message: "Remember to journal today",
      writtenBy: bobId,
      writtenFor: aliceId,
      read: false,
      writtenAt: now - 4000000,
      supportMarkdown: true,
    },
  ]) {
    const id = await createEntity("/v1/board", board, token, `boardMessage:${board.title}`);
    manifest.boardMessages.push({ sourceId: id, fields: board });
  }

  // --- Update user profile ---
  console.log("  Updating user profile...");
  await delay(REQUEST_DELAY_MS);
  await spFetch(`/v1/user/${systemId}`, {
    method: "PATCH",
    token,
    body: { desc: "Minimal test system", color: "#4488ff" },
  });

  return manifest;
}

// ---------------------------------------------------------------------------
// Adversarial mode entity creation
// ---------------------------------------------------------------------------

async function seedAdversarial(token: string, systemId: string): Promise<Manifest> {
  const manifest: Manifest = {
    systemId,
    mode: "adversarial",
    privacyBuckets: [],
    customFields: [],
    customFronts: [],
    members: [],
    groups: [],
    frontHistory: [],
    comments: [],
    notes: [],
    polls: [],
    channelCategories: [],
    channels: [],
    chatMessages: [],
    boardMessages: [],
  };

  // --- Privacy buckets (3: Unicode name, empty desc) ---
  console.log("  Creating privacy buckets...");
  for (const bucket of [
    { name: "Public", desc: "Everyone can see", color: "#00ff00", icon: "🌍", rank: "a0" },
    {
      name: "\u{1F308}\u{1F3F3}\u{FE0F}\u200D\u{1F308} Pride",
      desc: "",
      color: "#ff00ff",
      icon: "\u{1F3F3}\u{FE0F}\u200D\u{1F308}",
      rank: "a1",
    },
    {
      name: "\u6D4B\u8BD5\u79C1\u5BC6",
      desc: "Chinese characters in name",
      color: "#333333",
      icon: "\u{1F512}",
      rank: "a2",
    },
  ]) {
    const id = await createEntity(
      "/v1/privacyBucket",
      bucket,
      token,
      `privacyBucket:${bucket.name}`,
    );
    manifest.privacyBuckets.push({ sourceId: id, fields: bucket });
  }

  // --- Custom fields (4: multiple types) ---
  console.log("  Creating custom fields...");
  for (const field of [
    { name: "Pronouns", supportMarkdown: false, type: 0, order: "a0" },
    { name: "Role", supportMarkdown: false, type: 1, order: "a1" },
    { name: "Description", supportMarkdown: true, type: 2, order: "a2" },
    { name: "\u{1F3A8} Art Style", supportMarkdown: true, type: 3, order: "a3" },
  ]) {
    const id = await createEntity("/v1/customField", field, token, `customField:${field.name}`);
    manifest.customFields.push({ sourceId: id, fields: field });
  }

  // --- Custom fronts (3: private, null fields) ---
  console.log("  Creating custom fronts...");
  for (const front of [
    { name: "Dissociated" },
    { name: "Blurry" },
    { name: "\u200B" }, // zero-width space — edge case
  ]) {
    const id = await createEntity(
      "/v1/customFront",
      front,
      token,
      `customFront:${front.name || "empty"}`,
    );
    manifest.customFronts.push({ sourceId: id, fields: front });
  }

  // --- Members (5: archived, private, with/without buckets, Unicode) ---
  console.log("  Creating members...");
  for (const member of [
    { name: "Alice" },
    { name: "Bob" },
    { name: "\u00C9lise" }, // accented
    { name: "\u5C0F\u660E" }, // Chinese characters
    { name: "Archived-Test" },
  ]) {
    const id = await createEntity("/v1/member", member, token, `member:${member.name}`);
    manifest.members.push({ sourceId: id, fields: member });
  }

  const aliceId = manifest.members[0]!.sourceId;
  const bobId = manifest.members[1]!.sourceId;
  const eliseId = manifest.members[2]!.sourceId;
  const xiaoMingId = manifest.members[3]!.sourceId;
  const archivedId = manifest.members[4]!.sourceId;

  // Archive the archived member
  await delay(REQUEST_DELAY_MS);
  await spFetch(`/v1/member/${archivedId}`, {
    method: "PATCH",
    token,
    body: { archived: true },
  });

  // --- Groups (3: nested chain, empty members, member overlap) ---
  console.log("  Creating groups...");
  const rootGroupFields = {
    parent: "",
    color: "#3366ff",
    name: "Root Group",
    desc: "Top-level group",
    emoji: "🌟",
    members: [aliceId, bobId],
  };
  const rootGroupId = await createEntity("/v1/group", rootGroupFields, token, "group:Root Group");
  manifest.groups.push({ sourceId: rootGroupId, fields: rootGroupFields });

  const midGroupFields = {
    parent: rootGroupId,
    color: "#9933ff",
    name: "Mid Group",
    desc: "Nested under root",
    emoji: "🔮",
    members: [aliceId, eliseId],
  };
  const midGroupId = await createEntity("/v1/group", midGroupFields, token, "group:Mid Group");
  manifest.groups.push({ sourceId: midGroupId, fields: midGroupFields });

  const emptyGroupFields = {
    parent: midGroupId,
    color: "#cc0000",
    name: "Empty Leaf",
    desc: "Group with no members",
    emoji: "🍂",
    members: [] as string[],
  };
  const emptyGroupId = await createEntity("/v1/group", emptyGroupFields, token, "group:Empty Leaf");
  manifest.groups.push({ sourceId: emptyGroupId, fields: emptyGroupFields });

  // --- Front history (6: zero-duration, old timestamps, custom status) ---
  console.log("  Creating front history...");
  const now = Date.now();
  const customFrontId0 = manifest.customFronts[0]!.sourceId;
  const customFrontId1 = manifest.customFronts[1]!.sourceId;

  const frontEntries = [
    // ended member front
    {
      custom: false,
      live: false,
      startTime: now - 7200000,
      endTime: now - 3600000,
      member: aliceId,
    },
    // zero-duration ended front
    { custom: false, live: false, startTime: now - 5000000, endTime: now - 5000000, member: bobId },
    // old timestamp (30 days ago)
    {
      custom: false,
      live: false,
      startTime: now - 2592000000,
      endTime: now - 2591000000,
      member: eliseId,
    },
    // live member front
    { custom: false, live: true, startTime: now - 300000, member: xiaoMingId },
    // ended custom front
    {
      custom: true,
      live: false,
      startTime: now - 4000000,
      endTime: now - 3500000,
      member: customFrontId0,
    },
    // live custom front
    { custom: true, live: true, startTime: now - 120000, member: customFrontId1 },
  ];

  for (const entry of frontEntries) {
    const body: Record<string, unknown> = {
      custom: entry.custom,
      live: entry.live,
      startTime: entry.startTime,
      member: entry.member,
    };
    if ("endTime" in entry && !entry.live) {
      body["endTime"] = entry.endTime;
    }
    const label = `frontHistory:${entry.custom ? "custom" : "member"}:${entry.live ? "live" : "ended"}`;
    const id = await createEntity("/v1/frontHistory", body, token, label);
    manifest.frontHistory.push({ sourceId: id, fields: body });
  }

  // --- Comments (4: empty text, long text, Unicode) ---
  console.log("  Creating comments...");
  const frontHistId0 = manifest.frontHistory[0]!.sourceId;
  const frontHistId2 = manifest.frontHistory[2]!.sourceId;

  for (const comment of [
    {
      time: now - 3500000,
      text: "Normal comment",
      documentId: frontHistId0,
      collection: "frontHistory",
    },
    { time: now - 3400000, text: "", documentId: frontHistId0, collection: "frontHistory" },
    {
      time: now - 2590000000,
      text: "A".repeat(500),
      documentId: frontHistId2,
      collection: "frontHistory",
    },
    {
      time: now - 2589000000,
      text: "\u{1F4DD} \u65E5\u672C\u8A9E\u30C6\u30B9\u30C8 \u{1F30F}",
      documentId: frontHistId2,
      collection: "frontHistory",
    },
  ]) {
    const id = await createEntity(
      "/v1/comment",
      comment,
      token,
      `comment:${(comment.text || "empty").slice(0, 20)}`,
    );
    manifest.comments.push({ sourceId: id, fields: comment });
  }

  // --- Notes (4: empty title, markdown, very long) ---
  console.log("  Creating notes...");
  for (const note of [
    {
      title: "Session recap",
      note: "Today was productive",
      color: "#ffcc00",
      member: aliceId,
      date: now - 86400000,
    },
    {
      title: "",
      note: "Note with empty title",
      color: "#ff0000",
      member: bobId,
      date: now - 172800000,
    },
    {
      title: "Markdown note",
      note: "# Heading\n\n- item 1\n- item 2\n\n**bold** and *italic*",
      color: "#66ccff",
      member: eliseId,
      date: now - 259200000,
    },
    {
      title: "Long note",
      note: "Lorem ipsum ".repeat(200).trim(),
      color: "#cccccc",
      member: xiaoMingId,
      date: now - 345600000,
    },
  ]) {
    const id = await createEntity("/v1/note", note, token, `note:${note.title || "empty"}`);
    manifest.notes.push({ sourceId: id, fields: note });
  }

  // --- Polls (3: votes/veto, abstain) ---
  console.log("  Creating polls...");
  const customPoll1Fields = {
    name: "Favorite snack",
    desc: "What should we eat?",
    custom: true,
    endTime: now + 86400000,
    options: [
      { name: "Chips", color: "#ffaa00" },
      { name: "Fruit", color: "#00cc66" },
      { name: "Veto", color: "#ff0000" },
    ],
  };
  const customPoll1Id = await createEntity(
    "/v1/poll",
    customPoll1Fields,
    token,
    "poll:Favorite snack",
  );
  manifest.polls.push({ sourceId: customPoll1Id, fields: customPoll1Fields });

  const customPoll2Fields = {
    name: "\u{1F4CA} \u6295\u7968",
    desc: "Unicode poll name",
    custom: true,
    endTime: now + 172800000,
    options: [
      { name: "\u306F\u3044", color: "#00ff00" },
      { name: "\u3044\u3044\u3048", color: "#ff0000" },
    ],
  };
  const customPoll2Id = await createEntity("/v1/poll", customPoll2Fields, token, "poll:Unicode");
  manifest.polls.push({ sourceId: customPoll2Id, fields: customPoll2Fields });

  const standardPollFields = {
    name: "Go outside today?",
    desc: "Simple yes/no vote",
    custom: false,
    endTime: now + 86400000,
  };
  const standardPollId = await createEntity(
    "/v1/poll",
    standardPollFields,
    token,
    "poll:Go outside",
  );
  manifest.polls.push({ sourceId: standardPollId, fields: standardPollFields });

  // --- Channel categories (2) ---
  console.log("  Creating channel categories...");
  for (const cat of [
    { name: "General", desc: "General discussion" },
    { name: "\u{1F3AE} Gaming", desc: "Gaming channels" },
  ]) {
    const id = await createEntity("/v1/chat/category", cat, token, `channelCategory:${cat.name}`);
    manifest.channelCategories.push({ sourceId: id, fields: cat });
  }

  // --- Channels (3: one orphaned) ---
  console.log("  Creating channels...");
  const cat0Id = manifest.channelCategories[0]!.sourceId;
  const cat1Id = manifest.channelCategories[1]!.sourceId;

  for (const channel of [
    { name: "daily-check-in", desc: "Daily check-ins", category: cat0Id },
    { name: "game-talk", desc: "Talk about games", category: cat1Id },
    { name: "orphan-channel", desc: "No category assigned" },
  ]) {
    const id = await createEntity("/v1/chat/channel", channel, token, `channel:${channel.name}`);
    manifest.channels.push({ sourceId: id, fields: channel });
  }

  // --- Chat messages (5: reply chains, Unicode) ---
  console.log("  Creating chat messages...");
  const channelId0 = manifest.channels[0]!.sourceId;
  const channelId1 = manifest.channels[1]!.sourceId;

  for (const msg of [
    {
      message: "Good morning everyone",
      channel: channelId0,
      writer: aliceId,
      writtenAt: now - 7000000,
    },
    { message: "Hi Alice!", channel: channelId0, writer: bobId, writtenAt: now - 6900000 },
    {
      message: "How is everyone feeling?",
      channel: channelId0,
      writer: aliceId,
      writtenAt: now - 6800000,
    },
    {
      message: "\u304A\u306F\u3088\u3046\u3054\u3056\u3044\u307E\u3059",
      channel: channelId1,
      writer: eliseId,
      writtenAt: now - 5000000,
    },
    {
      message: "\u{1F44B} \u4F60\u597D!",
      channel: channelId1,
      writer: xiaoMingId,
      writtenAt: now - 4900000,
    },
  ]) {
    const id = await createEntity(
      "/v1/chat/message",
      msg,
      token,
      `chatMessage:${msg.message.slice(0, 20)}`,
    );
    manifest.chatMessages.push({ sourceId: id, fields: msg });
  }

  // --- Board messages (3: readBy, title boundary) ---
  console.log("  Creating board messages...");
  for (const board of [
    {
      title: "Welcome note",
      message: "Welcome to the system board!",
      writtenBy: aliceId,
      writtenFor: bobId,
      read: false,
      writtenAt: now - 5000000,
      supportMarkdown: false,
    },
    {
      title: "A".repeat(70),
      message: "Testing max title length boundary",
      writtenBy: bobId,
      writtenFor: aliceId,
      read: true,
      writtenAt: now - 4000000,
      supportMarkdown: false,
    },
    {
      title: "\u{1F4E8} Message",
      message: "\u{1F30D} \u4E16\u754C\u5404\u5730\u304B\u3089\u306E\u30E1\u30C3\u30BB\u30FC\u30B8",
      writtenBy: eliseId,
      writtenFor: xiaoMingId,
      read: false,
      writtenAt: now - 3000000,
      supportMarkdown: true,
    },
  ]) {
    const id = await createEntity(
      "/v1/board",
      board,
      token,
      `boardMessage:${board.title.slice(0, 20)}`,
    );
    manifest.boardMessages.push({ sourceId: id, fields: board });
  }

  // --- Update user profile ---
  console.log("  Updating user profile...");
  await delay(REQUEST_DELAY_MS);
  await spFetch(`/v1/user/${systemId}`, {
    method: "PATCH",
    token,
    body: { desc: "\u{1F308} Adversarial test system \u6D4B\u8BD5", color: "#ff00ff" },
  });

  return manifest;
}

// ---------------------------------------------------------------------------
// File output
// ---------------------------------------------------------------------------

function writeEnvFile(mode: SpMode, email: string, token: string, systemId: string): void {
  const prefix = mode === "minimal" ? "SP_TEST_MINIMAL" : "SP_TEST_ADVERSARIAL";
  const content = [
    `${prefix}_EMAIL=${email}`,
    `${prefix}_PASSWORD=${SP_PASSWORD}`,
    `${prefix}_TOKEN=${token}`,
    `${prefix}_SYSTEM_ID=${systemId}`,
    `${prefix}_MANIFEST=scripts/.sp-test-${mode}-manifest.json`,
    "",
  ].join("\n");
  const filePath = `.env.sp-test-${mode}`;
  writeFileSync(filePath, content, "utf-8");
  console.log(`  Wrote ${filePath}`);
}

function writeManifest(mode: SpMode, manifest: Manifest): void {
  const filePath = `scripts/.sp-test-${mode}-manifest.json`;
  writeFileSync(filePath, JSON.stringify(manifest, null, 2) + "\n", "utf-8");
  console.log(`  Wrote ${filePath}`);
}

// ---------------------------------------------------------------------------
// Export trigger
// ---------------------------------------------------------------------------

async function triggerExport(token: string, systemId: string): Promise<void> {
  console.log("  Triggering SP data export...");
  await delay(REQUEST_DELAY_MS);
  await spFetch(`/v1/user/${systemId}/export`, { method: "POST", token, body: {} });
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function seedMode(mode: SpMode, email: string): Promise<void> {
  console.log(`\n=== Seeding ${mode} mode ===`);

  const { token, systemId } = await registerAndLogin(email);
  console.log(`  System ID: ${systemId}`);

  const manifest =
    mode === "minimal"
      ? await seedMinimal(token, systemId)
      : await seedAdversarial(token, systemId);

  await triggerExport(token, systemId);

  writeEnvFile(mode, email, token, systemId);
  writeManifest(mode, manifest);

  console.log(`  ${mode} mode complete.`);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args.length < 2) {
    console.error("Usage: pnpm seed:sp-test <minimal-email> <adversarial-email>");
    process.exit(1);
  }

  const [minimalEmail, adversarialEmail] = args as [string, string];

  console.log("SP Test Data Seeding Script");
  console.log("==========================");
  console.log(`Minimal email:     ${minimalEmail}`);
  console.log(`Adversarial email: ${adversarialEmail}`);
  console.log(`SP API base:       ${SP_BASE_URL}`);

  await seedMode("minimal", minimalEmail);
  await seedMode("adversarial", adversarialEmail);

  console.log("\n=== All done ===");
  console.log("Credential files:  .env.sp-test-minimal, .env.sp-test-adversarial");
  console.log(
    "Manifest files:    scripts/.sp-test-minimal-manifest.json, scripts/.sp-test-adversarial-manifest.json",
  );
}

main().catch((error: unknown) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
