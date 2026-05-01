import type {
  EncryptedInput,
  EncryptedUpdate,
  PersisterApi,
} from "../persister/persister.types.js";
import type { TRPCClientSubset } from "../trpc-persister-api.types.js";
import type { PollKind, SystemId } from "@pluralscape/types";

type FrontingAndContentSection = Pick<
  PersisterApi,
  "frontingSession" | "frontingComment" | "note" | "poll"
>;

export function buildFrontingAndContentSection(
  client: TRPCClientSubset,
): FrontingAndContentSection {
  return {
    frontingSession: {
      create: async (
        sysId: SystemId,
        payload: EncryptedInput & {
          readonly startTime: number;
          readonly memberId: string | null;
          readonly customFrontId: string | null;
          readonly structureEntityId: string | null;
        },
      ) => {
        return client.frontingSession.create.mutate({
          systemId: sysId,
          encryptedData: payload.encryptedData,
          startTime: payload.startTime,
          memberId: payload.memberId,
          customFrontId: payload.customFrontId,
          structureEntityId: payload.structureEntityId,
        });
      },
      update: async (sysId: SystemId, entityId: string, payload: EncryptedUpdate) => {
        return client.frontingSession.update.mutate({
          systemId: sysId,
          sessionId: entityId,
          encryptedData: payload.encryptedData,
          version: payload.version,
        });
      },
    },

    frontingComment: {
      create: async (
        sysId: SystemId,
        payload: EncryptedInput & {
          readonly sessionId: string;
          readonly memberId: string | null;
          readonly customFrontId: string | null;
          readonly structureEntityId: string | null;
        },
      ) => {
        return client.frontingComment.create.mutate({
          systemId: sysId,
          sessionId: payload.sessionId,
          encryptedData: payload.encryptedData,
          ...(payload.memberId !== null ? { memberId: payload.memberId } : {}),
          ...(payload.customFrontId !== null ? { customFrontId: payload.customFrontId } : {}),
          ...(payload.structureEntityId !== null
            ? { structureEntityId: payload.structureEntityId }
            : {}),
        });
      },
      update: async (
        sysId: SystemId,
        entityId: string,
        payload: EncryptedUpdate & { readonly sessionId: string },
      ) => {
        return client.frontingComment.update.mutate({
          systemId: sysId,
          sessionId: payload.sessionId,
          commentId: entityId,
          encryptedData: payload.encryptedData,
          version: payload.version,
        });
      },
    },

    note: {
      create: async (
        sysId: SystemId,
        payload: EncryptedInput & {
          readonly author: { readonly entityType: "member"; readonly entityId: string } | null;
        },
      ) => {
        return client.note.create.mutate({
          systemId: sysId,
          encryptedData: payload.encryptedData,
          author: payload.author,
        });
      },
      update: async (sysId: SystemId, entityId: string, payload: EncryptedUpdate) => {
        return client.note.update.mutate({
          systemId: sysId,
          noteId: entityId,
          encryptedData: payload.encryptedData,
          version: payload.version,
        });
      },
    },

    poll: {
      create: async (
        sysId: SystemId,
        payload: EncryptedInput & {
          readonly kind: PollKind;
          readonly allowMultipleVotes: boolean;
          readonly maxVotesPerMember: number;
          readonly allowAbstain: boolean;
          readonly allowVeto: boolean;
        },
      ) => {
        return client.poll.create.mutate({
          systemId: sysId,
          encryptedData: payload.encryptedData,
          kind: payload.kind,
          createdByMemberId: undefined,
          allowMultipleVotes: payload.allowMultipleVotes,
          maxVotesPerMember: payload.maxVotesPerMember,
          allowAbstain: payload.allowAbstain,
          allowVeto: payload.allowVeto,
        });
      },
      update: async (sysId: SystemId, entityId: string, payload: EncryptedUpdate) => {
        return client.poll.update.mutate({
          systemId: sysId,
          pollId: entityId,
          encryptedData: payload.encryptedData,
          version: payload.version,
        });
      },
      castVote: async (
        sysId: SystemId,
        input: {
          readonly pollId: string;
          readonly memberId: string | null;
          readonly encryptedData: string;
        },
      ) => {
        return client.poll.castVote.mutate({
          systemId: sysId,
          pollId: input.pollId,
          encryptedData: input.encryptedData,
        });
      },
    },
  };
}
