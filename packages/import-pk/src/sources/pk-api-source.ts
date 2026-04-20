/**
 * API-based PK import source.
 *
 * Wraps pkapi.js to fetch members, groups, and switches from the PluralKit
 * API. During member iteration, privacy data is collected and later yielded
 * as a synthetic "privacy-scan" document for the privacy-bucket collection.
 *
 * pkapi.js returns class instances (Member, Group, Switch) with Map-based
 * collections. We convert them to plain objects matching the PK export schema
 * shapes so the same validators and mappers work for both file and API sources.
 */
import PKAPI from "pkapi.js";
import { z } from "zod/v4";

import { PK_COLLECTION_NAMES } from "./pk-collections.js";

import type { ImportDataSource, SourceEvent } from "@pluralscape/import-core";
import type { Member, Switch as PkSwitch } from "pkapi.js";

const PrivacyFieldSchema = z.record(z.string(), z.string());

function safeParsePrivacy(raw: unknown): Record<string, string> | undefined {
  if (raw === undefined || raw === null) return undefined;
  const result = PrivacyFieldSchema.safeParse(raw);
  return result.success ? result.data : undefined;
}

export interface PkApiImportSourceArgs {
  readonly token: string;
  readonly baseUrl?: string;
}

const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

/**
 * Refuse to send the PK API token to a plaintext-HTTP baseUrl. The only
 * exception is loopback, for local dev against a mock or self-hosted PK
 * instance on the same machine. Mirrors the assertBaseUrlIsSafe guard in
 * packages/import-sp/src/sources/api-source.ts — the last-line safety net
 * that prevents a token from ever leaving the device over cleartext.
 */
function assertBaseUrlIsSafe(baseUrl: string): void {
  let parsed: URL;
  try {
    parsed = new URL(baseUrl);
  } catch (cause) {
    throw new Error(`PK import: baseUrl is not a valid URL: ${baseUrl}`, { cause });
  }
  // `URL.hostname` preserves the `[...]` brackets for IPv6 literals (e.g.
  // `[::1]`). Strip them so the bare address compares against LOOPBACK_HOSTS.
  const host = parsed.hostname.replace(/^\[|\]$/g, "");
  if (parsed.protocol === "https:") return;
  if (parsed.protocol === "http:" && LOOPBACK_HOSTS.has(host)) return;
  throw new Error(
    `PK import: refusing to send API token to a non-HTTPS baseUrl (${baseUrl}). ` +
      `Use https:// for remote hosts; http:// is only permitted for loopback (localhost, 127.0.0.1, ::1).`,
  );
}

/**
 * Reject obviously-invalid tokens before they reach pkapi.js. pkapi.js happily
 * sends empty/whitespace tokens and surfaces a server 401 only after a round
 * trip — which leaves a blank Authorization header on the wire. This guard
 * short-circuits at the source boundary.
 *
 * Note: the guard rejects empty-or-whitespace-only tokens but preserves any
 * surrounding whitespace on an otherwise-valid token. Tokens are opaque
 * secrets; silently trimming them is surprising and can mask copy-paste bugs
 * that the caller should see as a 401 rather than a silent rewrite.
 */
function assertTokenIsSane(token: string): void {
  if (token.trim().length === 0) {
    throw new Error("PK import: token must be a non-empty string");
  }
}

interface CollectedMemberPrivacy {
  readonly pkMemberId: string;
  readonly privacy?: Record<string, string>;
}

/**
 * Safely extract member IDs from a pkapi.js members field.
 * The field can be `Map<string, Member> | Array<string> | undefined`.
 */
function extractMemberIds(members: Map<string, Member> | string[] | undefined): readonly string[] {
  if (members === undefined) return [];
  if (Array.isArray(members)) return members;
  return [...members.keys()];
}

/**
 * Safely extract a timestamp string from a pkapi.js Switch.
 * The field can be `Date | string`.
 */
function extractTimestamp(sw: PkSwitch): string {
  const ts: Date | string = sw.timestamp;
  if (typeof ts === "string") return ts;
  if (ts instanceof Date) return ts.toISOString();
  return String(ts);
}

export function createPkApiImportSource(args: PkApiImportSourceArgs): ImportDataSource {
  assertTokenIsSane(args.token);
  // Only validate baseUrl when caller overrides the pkapi.js default — the
  // SDK's built-in default (https://api.pluralkit.me) is already HTTPS and
  // leaving `undefined` alone lets pkapi.js apply its own fallback.
  if (args.baseUrl !== undefined) assertBaseUrlIsSafe(args.baseUrl);

  const api = new PKAPI({
    token: args.token,
    base_url: args.baseUrl,
    debug: false,
  });

  /** Collected during member iteration for the synthetic privacy-scan document. */
  const memberPrivacyData: CollectedMemberPrivacy[] = [];

  return {
    mode: "api",

    listCollections(): Promise<readonly string[]> {
      return Promise.resolve([...PK_COLLECTION_NAMES]);
    },

    async *iterate(collection: string): AsyncGenerator<SourceEvent> {
      switch (collection) {
        case "member": {
          const membersMap = await api.getMembers({ system: "@me" });
          for (const [id, member] of membersMap) {
            // Collect privacy data for the synthetic privacy-scan pass.
            const privacyObj = safeParsePrivacy(member.privacy);
            memberPrivacyData.push({ pkMemberId: id, privacy: privacyObj });

            yield {
              kind: "doc",
              collection,
              sourceId: id,
              document: {
                id: member.id,
                uuid: member.uuid,
                name: member.name,
                display_name: member.display_name ?? null,
                pronouns: member.pronouns ?? null,
                description: member.description ?? null,
                color: member.color ?? null,
                avatar_url: member.avatar_url ?? null,
                created: typeof member.created === "string" ? member.created : undefined,
                privacy: privacyObj,
                proxy_tags: member.proxy_tags,
                birthday:
                  member.birthday !== null && member.birthday !== undefined
                    ? typeof member.birthday === "string"
                      ? member.birthday
                      : null
                    : null,
                banner: member.banner ?? null,
                webhook_avatar_url: member.webhook_avatar_url ?? null,
                keep_proxy: member.keep_proxy,
                tts: member.tts,
                autoproxy_enabled: member.autoproxy_enabled,
                message_count: member.message_count,
              },
            };
          }
          break;
        }

        case "group": {
          // Fetch groups with raw member ID arrays (not resolved Member objects).
          const groupsMap = await api.getGroups({ system: "@me", raw: true });
          for (const [id, group] of groupsMap) {
            const memberIds = extractMemberIds(group.members);
            yield {
              kind: "doc",
              collection,
              sourceId: id,
              document: {
                id: group.id,
                uuid: group.uuid,
                name: group.name,
                display_name: group.display_name ?? null,
                description: group.description ?? null,
                icon: group.icon ?? null,
                banner: group.banner ?? null,
                color: group.color ?? null,
                members: memberIds,
                privacy: safeParsePrivacy(group.privacy),
              },
            };
          }
          break;
        }

        case "switch": {
          // Fetch switches with raw member ID arrays.
          const switchesResult: unknown = await api.getSwitches({ system: "@me", raw: true });
          if (!(switchesResult instanceof Map)) {
            const resultType = switchesResult === null ? "null" : typeof switchesResult;
            yield {
              kind: "drop",
              collection,
              sourceId: null,
              reason: `getSwitches returned ${resultType} instead of Map; switches will be empty`,
            };
            break;
          }
          const switches: PkSwitch[] = [...switchesResult.values()] as PkSwitch[];

          for (let i = 0; i < switches.length; i += 1) {
            const sw = switches[i];
            if (sw === undefined) continue;
            const memberIds = extractMemberIds(sw.members);
            const timestamp = extractTimestamp(sw);
            yield {
              kind: "doc",
              collection,
              sourceId: sw.id || `switch-${String(i)}`,
              document: {
                id: sw.id,
                timestamp,
                members: memberIds,
              },
            };
          }
          break;
        }

        case "privacy-bucket": {
          // Yield a synthetic privacy-scan document from data collected
          // during the member iteration pass.
          yield {
            kind: "doc",
            collection,
            sourceId: "synthetic:privacy-scan",
            document: { type: "privacy-scan" as const, members: memberPrivacyData },
          };
          break;
        }
        // Unknown collection: yield nothing.
      }
    },

    close(): Promise<void> {
      memberPrivacyData.length = 0;
      return Promise.resolve();
    },
  };
}
