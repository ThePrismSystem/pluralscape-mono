/**
 * Switch-to-FrontingSession batch mapper.
 *
 * PK records "switches" — timestamped snapshots of who is currently fronting.
 * Pluralscape models individual fronting sessions with start/end times. This
 * mapper diffs consecutive switch snapshots to derive overlapping per-member
 * sessions.
 *
 * Algorithm:
 * 1. Parse and sort switches by timestamp (stable sort preserves array order
 *    for duplicate timestamps).
 * 2. Track active fronters: `Map<pkMemberId, startTimeMs>`.
 * 3. For each switch, diff against current fronters: members no longer present
 *    emit a completed session; new members record a start time.
 * 4. After the final switch, remaining active fronters become open sessions
 *    (endTime = null).
 */
import { mapped, type BatchMapperOutput, type SourceDocument } from "@pluralscape/import-core";
import { brandId } from "@pluralscape/types";

import { PKSwitchSchema } from "../validators/pk-payload.js";

import type { FrontingSessionEncryptedFields } from "@pluralscape/data";
import type { MappingContext } from "@pluralscape/import-core";
import type { MemberId } from "@pluralscape/types";
import type { CreateFrontingSessionBodySchema } from "@pluralscape/validation";
import type { z } from "zod/v4";

export type PkMappedFrontingSession = Omit<
  z.infer<typeof CreateFrontingSessionBodySchema>,
  "encryptedData" | "endTime"
> & {
  readonly encrypted: FrontingSessionEncryptedFields;
  readonly endTime: number | null;
};

interface ParsedSwitch {
  readonly timestampMs: number;
  readonly members: readonly string[];
}

function buildSession(
  memberId: MemberId,
  startTime: number,
  endTime: number | null,
): PkMappedFrontingSession {
  const encrypted: FrontingSessionEncryptedFields = {
    comment: null,
    positionality: null,
    outtrigger: null,
    outtriggerSentiment: null,
  };
  return {
    encrypted,
    startTime,
    endTime,
    memberId,
    customFrontId: undefined,
    structureEntityId: undefined,
  };
}

export function mapSwitchBatch(
  documents: readonly SourceDocument[],
  ctx: MappingContext,
): readonly BatchMapperOutput[] {
  if (documents.length === 0) return [];

  // 1. Parse and sort by timestamp (stable sort)
  const parsed: ParsedSwitch[] = [];
  for (const doc of documents) {
    const validation = PKSwitchSchema.safeParse(doc.document);
    if (!validation.success) {
      const firstIssue = validation.error.issues[0];
      ctx.addWarning({
        entityType: "fronting-session",
        entityId: doc.sourceId,
        message: `Switch validation failed: ${firstIssue?.message ?? "invalid document"}`,
      });
      continue;
    }
    const sw = validation.data;
    const timestampMs = Date.parse(sw.timestamp);
    if (Number.isNaN(timestampMs)) {
      ctx.addWarning({
        entityType: "fronting-session",
        entityId: doc.sourceId,
        message: `Switch has unparseable timestamp "${sw.timestamp}" — skipping`,
      });
      continue;
    }
    parsed.push({ timestampMs, members: sw.members });
  }
  if (parsed.length === 0) return [];
  parsed.sort((a, b) => a.timestampMs - b.timestampMs);

  // 2. Track active fronters: pkMemberId -> startTimeMs
  //    resolvedIds caches the translation so we never need non-null assertions.
  const activeFronters = new Map<string, number>();
  const resolvedIds = new Map<string, string>();
  const outputs: BatchMapperOutput[] = [];

  // 3. Process each switch
  for (const sw of parsed) {
    const currentMembers = new Set<string>();

    // Resolve members for this switch, skipping unknown
    for (const pkMemberId of sw.members) {
      const cached = resolvedIds.get(pkMemberId);
      if (cached !== undefined) {
        currentMembers.add(pkMemberId);
        continue;
      }
      const resolved = ctx.translate("member", pkMemberId);
      if (resolved === null) {
        ctx.addWarning({
          entityType: "switch",
          entityId: null,
          message: `Switch references unknown member "${pkMemberId}" — skipping`,
        });
        continue;
      }
      resolvedIds.set(pkMemberId, resolved);
      currentMembers.add(pkMemberId);
    }

    // Close sessions for members no longer fronting
    for (const [pkMemberId, startTime] of activeFronters) {
      if (!currentMembers.has(pkMemberId)) {
        const resolved = resolvedIds.get(pkMemberId);
        if (resolved === undefined) {
          throw new Error(
            `Invariant violation: unresolved member "${pkMemberId}" in activeFronters`,
          );
        }
        // PK allows duplicate timestamps on consecutive switches, which produces
        // zero-duration sessions (endTime === startTime). Bump endTime by 1 ms so
        // every PK fronting session is captured rather than rejected by the API's
        // "endTime must be after startTime" constraint.
        const endTime = sw.timestampMs === startTime ? sw.timestampMs + 1 : sw.timestampMs;
        outputs.push({
          sourceEntityId: `session:${pkMemberId}:${String(startTime)}`,
          result: mapped(buildSession(brandId<MemberId>(resolved), startTime, endTime)),
        });
        activeFronters.delete(pkMemberId);
      }
    }

    // Start sessions for newly-fronting members
    for (const pkMemberId of currentMembers) {
      if (!activeFronters.has(pkMemberId)) {
        activeFronters.set(pkMemberId, sw.timestampMs);
      }
    }
  }

  // 4. Remaining active fronters become open sessions
  for (const [pkMemberId, startTime] of activeFronters) {
    const resolved = resolvedIds.get(pkMemberId);
    if (resolved === undefined) {
      throw new Error(`Invariant violation: unresolved member "${pkMemberId}" in activeFronters`);
    }
    outputs.push({
      sourceEntityId: `session:${pkMemberId}:${String(startTime)}`,
      result: mapped(buildSession(brandId<MemberId>(resolved), startTime, null)),
    });
  }

  return outputs;
}
