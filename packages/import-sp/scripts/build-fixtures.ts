/**
 * Build SP test export fixtures.
 *
 * Run: `pnpm --filter @pluralscape/import-sp build-fixtures`
 *   or: `tsx packages/import-sp/scripts/build-fixtures.ts`
 *
 * Writes minimal, realistic, and corrupted JSON exports to test-fixtures/.
 * Re-run after schema changes to keep fixtures in sync with the Zod validators
 * in `src/validators/sp-payload.ts`.
 */
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const FIXTURE_DIR = join(SCRIPT_DIR, "..", "test-fixtures");

const ID_PAD_WIDTH = 8;
const REALISTIC_MEMBER_COUNT = 20;
const REALISTIC_SESSION_COUNT = 50;
const BUCKET_ROTATION = 3;
const REALISTIC_BASE_TIME_MS = 1_700_000_000_000;
const ONE_DAY_MS = 86_400_000;
const ONE_HOUR_MS = 3_600_000;
const HEX_COLOR_STEP = 100_000;
const HEX_COLOR_LENGTH = 6;
const GROUP_A_SIZE = 5;

function id(prefix: string, n: number): string {
  return `${prefix}_${String(n).padStart(ID_PAD_WIDTH, "0")}`;
}

function buildMinimal(): unknown {
  return {
    privacyBuckets: [{ _id: id("bk", 1), name: "Public" }],
    customFields: [{ _id: id("cf", 1), name: "Likes", type: "text", order: 0 }],
    members: [
      {
        _id: id("m", 1),
        name: "Aria",
        info: { [id("cf", 1)]: "books" },
        buckets: [id("bk", 1)],
      },
    ],
    frontHistory: [
      {
        _id: id("fh", 1),
        member: id("m", 1),
        custom: false,
        live: true,
        startTime: REALISTIC_BASE_TIME_MS,
        endTime: null,
      },
    ],
  };
}

function buildRealistic(): unknown {
  const members = Array.from({ length: REALISTIC_MEMBER_COUNT }, (_, i) => ({
    _id: id("m", i + 1),
    name: `Member ${String(i + 1)}`,
    pronouns: i % 3 === 0 ? "they/them" : "she/her",
    color: `#${(i * HEX_COLOR_STEP).toString(16).padStart(HEX_COLOR_LENGTH, "0").slice(0, HEX_COLOR_LENGTH)}`,
    info: { [id("cf", 1)]: `value-${String(i + 1)}` },
    buckets: [id("bk", (i % BUCKET_ROTATION) + 1)],
  }));

  const sessions = Array.from({ length: REALISTIC_SESSION_COUNT }, (_, i) => {
    const isLive = i === REALISTIC_SESSION_COUNT - 1;
    const startTime = REALISTIC_BASE_TIME_MS + i * ONE_DAY_MS;
    return {
      _id: id("fh", i + 1),
      member: id("m", (i % REALISTIC_MEMBER_COUNT) + 1),
      custom: false,
      live: isLive,
      startTime,
      endTime: isLive ? null : startTime + ONE_HOUR_MS,
    };
  });

  return {
    users: [{ _id: id("u", 1), username: "Test System", color: "#ffaa00" }],
    private: [{ _id: id("p", 1), locale: "en", frontNotifs: true }],
    privacyBuckets: [
      { _id: id("bk", 1), name: "Public" },
      { _id: id("bk", 2), name: "Trusted" },
      { _id: id("bk", 3), name: "Private" },
    ],
    customFields: [
      { _id: id("cf", 1), name: "Favorite Color", type: "text", order: 0 },
      { _id: id("cf", 2), name: "Age", type: "number", order: 1 },
    ],
    frontStatuses: [
      { _id: id("fs", 1), name: "Tired" },
      { _id: id("fs", 2), name: "Dissociated" },
    ],
    members,
    groups: [
      {
        _id: id("g", 1),
        name: "Pod A",
        members: members.slice(0, GROUP_A_SIZE).map((m) => m._id),
      },
    ],
    frontHistory: sessions,
    comments: [
      {
        _id: id("cm", 1),
        documentId: id("fh", 1),
        text: "first front",
        time: REALISTIC_BASE_TIME_MS + 1_000,
      },
    ],
    notes: [
      {
        _id: id("nt", 1),
        title: "First note",
        note: "hello",
        date: REALISTIC_BASE_TIME_MS,
        member: id("m", 1),
      },
    ],
    polls: [
      {
        _id: id("pl", 1),
        name: "Dinner",
        options: [
          { id: "o1", name: "Pizza" },
          { id: "o2", name: "Sushi" },
        ],
      },
    ],
    channelCategories: [{ _id: id("cc", 1), name: "Day" }],
    channels: [{ _id: id("ch", 1), name: "general", parentCategory: id("cc", 1) }],
    chatMessages: [
      {
        _id: id("cmm", 1),
        channel: id("ch", 1),
        writer: id("m", 1),
        message: "hi",
        writtenAt: REALISTIC_BASE_TIME_MS + 2_000,
      },
    ],
    boardMessages: [
      {
        _id: id("bm", 1),
        title: "Board",
        message: "post",
        writer: id("m", 1),
        writtenAt: REALISTIC_BASE_TIME_MS + 3_000,
      },
    ],
  };
}

/**
 * Legacy export: no `privacyBuckets` collection. Members encode privacy
 * exclusively via the `private` / `preventTrusted` boolean pair, which
 * forces the engine into the synthesized-bucket code path.
 *
 * Four members cover every branch in `deriveBucketSourceIds`:
 *   1. `private: true`            → synthetic:private
 *   2. `preventTrusted: true`     → synthetic:public
 *   3. `private: false`           → synthetic:public + synthetic:trusted
 *   4. (no privacy flags)         → synthetic:private (fail-closed default)
 */
function buildLegacyNoBuckets(): unknown {
  return {
    customFields: [{ _id: id("cf", 1), name: "Likes", type: "text", order: 0 }],
    members: [
      { _id: id("m", 1), name: "Private Member", private: true },
      { _id: id("m", 2), name: "Prevented Member", preventTrusted: true },
      { _id: id("m", 3), name: "Public Member", private: false },
      { _id: id("m", 4), name: "Default Member" },
    ],
    frontHistory: [
      {
        _id: id("fh", 1),
        member: id("m", 1),
        custom: false,
        live: true,
        startTime: REALISTIC_BASE_TIME_MS,
        endTime: null,
      },
    ],
  };
}

function buildCorrupted(): unknown {
  return {
    members: [
      { _id: id("m", 1), name: "Valid Member" },
      { _id: id("m", 2) }, // missing name — mapper fails validation
      { name: "missing id" }, // missing _id — file source rejects at parse time
    ],
    frontHistory: [
      {
        _id: id("fh", 1),
        member: "nonexistent",
        custom: false,
        live: true,
        startTime: REALISTIC_BASE_TIME_MS,
        endTime: null,
      }, // FK miss: references a member that won't be mapped
    ],
  };
}

function writeJson(name: string, data: unknown): void {
  writeFileSync(join(FIXTURE_DIR, name), `${JSON.stringify(data, null, 2)}\n`);
  console.log(`wrote test-fixtures/${name}`);
}

writeJson("minimal.sp-export.json", buildMinimal());
writeJson("realistic.sp-export.json", buildRealistic());
writeJson("legacy-no-buckets.sp-export.json", buildLegacyNoBuckets());
writeJson("corrupted.sp-export.json", buildCorrupted());
