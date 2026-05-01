import type {
  EncryptedInput,
  EncryptedUpdate,
  PersisterApi,
} from "../persister/persister.types.js";
import type { TRPCClientSubset } from "../trpc-persister-api.types.js";
import type { SystemId } from "@pluralscape/types";

type MessagingAndGroupsClientSlice = Pick<
  TRPCClientSubset,
  "channel" | "message" | "boardMessage" | "group"
>;

type MessagingAndGroupsSection = Pick<
  PersisterApi,
  "channel" | "message" | "boardMessage" | "group"
>;

export function buildMessagingAndGroupsSection(
  client: MessagingAndGroupsClientSlice,
): MessagingAndGroupsSection {
  return {
    channel: {
      create: async (
        sysId: SystemId,
        input: EncryptedInput & {
          readonly type: "category" | "channel";
          readonly parentId: string | null;
          readonly sortOrder: number;
        },
      ) => {
        return client.channel.create.mutate({
          systemId: sysId,
          encryptedData: input.encryptedData,
          type: input.type,
          parentId: input.parentId,
          sortOrder: input.sortOrder,
        });
      },
      update: async (sysId: SystemId, entityId: string, payload: EncryptedUpdate) => {
        return client.channel.update.mutate({
          systemId: sysId,
          channelId: entityId,
          encryptedData: payload.encryptedData,
          version: payload.version,
        });
      },
    },

    message: {
      create: async (
        sysId: SystemId,
        input: EncryptedInput & {
          readonly channelId: string;
          readonly timestamp: number;
          readonly replyToId: string | null;
        },
      ) => {
        return client.message.create.mutate({
          systemId: sysId,
          channelId: input.channelId,
          encryptedData: input.encryptedData,
          timestamp: input.timestamp,
          replyToId: input.replyToId,
        });
      },
      update: async (
        sysId: SystemId,
        entityId: string,
        payload: EncryptedUpdate & { readonly channelId: string },
      ) => {
        return client.message.update.mutate({
          systemId: sysId,
          channelId: payload.channelId,
          messageId: entityId,
          encryptedData: payload.encryptedData,
          version: payload.version,
        });
      },
    },

    boardMessage: {
      create: async (
        sysId: SystemId,
        payload: EncryptedInput & { readonly sortOrder: number; readonly pinned: boolean },
      ) => {
        return client.boardMessage.create.mutate({
          systemId: sysId,
          encryptedData: payload.encryptedData,
          sortOrder: payload.sortOrder,
          pinned: payload.pinned,
        });
      },
      update: async (sysId: SystemId, entityId: string, payload: EncryptedUpdate) => {
        return client.boardMessage.update.mutate({
          systemId: sysId,
          boardMessageId: entityId,
          encryptedData: payload.encryptedData,
          version: payload.version,
        });
      },
    },

    group: {
      create: async (
        sysId: SystemId,
        input: EncryptedInput & {
          readonly memberIds: readonly string[];
          readonly parentGroupId: string | null;
          readonly sortOrder: number;
        },
      ) => {
        const result = await client.group.create.mutate({
          systemId: sysId,
          encryptedData: input.encryptedData,
          parentGroupId: input.parentGroupId,
          sortOrder: input.sortOrder,
        });

        const failedMembers: string[] = [];
        for (const memberId of input.memberIds) {
          try {
            await client.group.addMember.mutate({
              systemId: sysId,
              groupId: result.id,
              memberId,
            });
          } catch {
            failedMembers.push(memberId);
          }
        }
        if (failedMembers.length > 0) {
          throw new Error(
            `group ${result.id} created but ${String(failedMembers.length)}/${String(input.memberIds.length)} addMember calls failed`,
          );
        }

        return result;
      },
      update: async (
        sysId: SystemId,
        groupId: string,
        payload: EncryptedUpdate & { readonly memberIds?: readonly string[] },
      ) => {
        return client.group.update.mutate({
          systemId: sysId,
          groupId,
          encryptedData: payload.encryptedData,
          version: payload.version,
        });
      },
    },
  };
}
