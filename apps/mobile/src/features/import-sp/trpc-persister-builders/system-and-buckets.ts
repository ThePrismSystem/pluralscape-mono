import type {
  EncryptedInput,
  EncryptedUpdate,
  PersisterApi,
} from "../persister/persister.types.js";
import type { TRPCClientSubset } from "../trpc-persister-api.types.js";
import type { FieldType, SystemId } from "@pluralscape/types";

type SystemAndBucketsSection = Pick<
  PersisterApi,
  "system" | "systemSettings" | "bucket" | "field" | "customFront" | "member" | "friend"
>;

export function buildSystemAndBucketsSection(client: TRPCClientSubset): SystemAndBucketsSection {
  return {
    system: {
      getCurrentVersion: async (sysId: SystemId) => {
        const result = await client.system.get.query({ systemId: sysId });
        return result.version;
      },
      update: async (sysId: SystemId, payload: EncryptedUpdate) => {
        return client.system.update.mutate({
          systemId: sysId,
          encryptedData: payload.encryptedData,
          version: payload.version,
        });
      },
    },

    systemSettings: {
      getCurrentVersion: async (sysId: SystemId) => {
        const result = await client.systemSettings.settings.get.query({ systemId: sysId });
        return result.version;
      },
      update: async (sysId: SystemId, payload: EncryptedUpdate) => {
        return client.systemSettings.settings.update.mutate({
          systemId: sysId,
          encryptedData: payload.encryptedData,
          version: payload.version,
        });
      },
    },

    bucket: {
      create: async (sysId: SystemId, payload: EncryptedInput) => {
        return client.bucket.create.mutate({
          systemId: sysId,
          encryptedData: payload.encryptedData,
        });
      },
      update: async (sysId: SystemId, entityId: string, payload: EncryptedUpdate) => {
        return client.bucket.update.mutate({
          systemId: sysId,
          bucketId: entityId,
          encryptedData: payload.encryptedData,
          version: payload.version,
        });
      },
    },

    field: {
      create: async (
        sysId: SystemId,
        payload: EncryptedInput & {
          readonly fieldType: FieldType;
          readonly required: boolean;
          readonly sortOrder: number;
        },
      ) => {
        return client.field.definition.create.mutate({
          systemId: sysId,
          encryptedData: payload.encryptedData,
          fieldType: payload.fieldType,
          required: payload.required,
          sortOrder: payload.sortOrder,
        });
      },
      update: async (sysId: SystemId, entityId: string, payload: EncryptedUpdate) => {
        return client.field.definition.update.mutate({
          systemId: sysId,
          fieldDefinitionId: entityId,
          encryptedData: payload.encryptedData,
          version: payload.version,
        });
      },
      setValue: async (
        sysId: SystemId,
        input: {
          readonly memberId: string;
          readonly fieldDefinitionId: string;
          readonly encryptedData: string;
        },
      ) => {
        return client.field.value.set.mutate({
          systemId: sysId,
          fieldDefinitionId: input.fieldDefinitionId,
          owner: { kind: "member", id: input.memberId },
          encryptedData: input.encryptedData,
        });
      },
    },

    customFront: {
      create: async (sysId: SystemId, payload: EncryptedInput) => {
        return client.customFront.create.mutate({
          systemId: sysId,
          encryptedData: payload.encryptedData,
        });
      },
      update: async (sysId: SystemId, entityId: string, payload: EncryptedUpdate) => {
        return client.customFront.update.mutate({
          systemId: sysId,
          customFrontId: entityId,
          encryptedData: payload.encryptedData,
          version: payload.version,
        });
      },
    },

    member: {
      create: async (sysId: SystemId, payload: EncryptedInput) => {
        return client.member.create.mutate({
          systemId: sysId,
          encryptedData: payload.encryptedData,
        });
      },
      update: async (sysId: SystemId, memberId: string, payload: EncryptedUpdate) => {
        return client.member.update.mutate({
          systemId: sysId,
          memberId,
          encryptedData: payload.encryptedData,
          version: payload.version,
        });
      },
    },

    friend: {
      recordExternalReference: (_sysId: SystemId, externalUserId: string) =>
        Promise.resolve({ placeholderId: `import_friend_${externalUserId}` }),
    },
  };
}
