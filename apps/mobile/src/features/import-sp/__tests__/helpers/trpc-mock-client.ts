/**
 * Mock tRPC client factory for PersisterApi bridge tests.
 *
 * Provides a `MockTRPCClient` whose query/mutation leaves are vi.fn mocks
 * compatible with `TRPCClientSubset`, and a `makeMockClient()` factory that
 * fresh-builds one per test.
 */
import { vi } from "vitest";

import type { TRPCClientSubset } from "../../trpc-persister-api.js";
import type { Mock } from "vitest";

interface MockQuery<TInput, TOutput> {
  readonly query: Mock<(input: TInput) => Promise<TOutput>>;
}

interface MockMutation<TInput, TOutput> {
  readonly mutate: Mock<(input: TInput) => Promise<TOutput>>;
}

type ParamsOf<TFn> = TFn extends (input: infer P) => unknown ? P : never;
type ReturnOf<TFn> = TFn extends (...args: never) => infer R ? Awaited<R> : never;

type Q<P, R> = MockQuery<ParamsOf<P>, ReturnOf<R>>;
type M<P, R> = MockMutation<ParamsOf<P>, ReturnOf<R>>;

export interface MockTRPCClient extends TRPCClientSubset {
  readonly system: {
    readonly get: Q<TRPCClientSubset["system"]["get"]["query"], TRPCClientSubset["system"]["get"]["query"]>;
    readonly update: M<
      TRPCClientSubset["system"]["update"]["mutate"],
      TRPCClientSubset["system"]["update"]["mutate"]
    >;
  };
  readonly systemSettings: {
    readonly settings: {
      readonly get: Q<
        TRPCClientSubset["systemSettings"]["settings"]["get"]["query"],
        TRPCClientSubset["systemSettings"]["settings"]["get"]["query"]
      >;
      readonly update: M<
        TRPCClientSubset["systemSettings"]["settings"]["update"]["mutate"],
        TRPCClientSubset["systemSettings"]["settings"]["update"]["mutate"]
      >;
    };
  };
  readonly bucket: {
    readonly create: M<
      TRPCClientSubset["bucket"]["create"]["mutate"],
      TRPCClientSubset["bucket"]["create"]["mutate"]
    >;
    readonly update: M<
      TRPCClientSubset["bucket"]["update"]["mutate"],
      TRPCClientSubset["bucket"]["update"]["mutate"]
    >;
  };
  readonly field: {
    readonly definition: {
      readonly create: M<
        TRPCClientSubset["field"]["definition"]["create"]["mutate"],
        TRPCClientSubset["field"]["definition"]["create"]["mutate"]
      >;
      readonly update: M<
        TRPCClientSubset["field"]["definition"]["update"]["mutate"],
        TRPCClientSubset["field"]["definition"]["update"]["mutate"]
      >;
    };
    readonly value: {
      readonly set: M<
        TRPCClientSubset["field"]["value"]["set"]["mutate"],
        TRPCClientSubset["field"]["value"]["set"]["mutate"]
      >;
    };
  };
  readonly customFront: {
    readonly create: M<
      TRPCClientSubset["customFront"]["create"]["mutate"],
      TRPCClientSubset["customFront"]["create"]["mutate"]
    >;
    readonly update: M<
      TRPCClientSubset["customFront"]["update"]["mutate"],
      TRPCClientSubset["customFront"]["update"]["mutate"]
    >;
  };
  readonly member: {
    readonly create: M<
      TRPCClientSubset["member"]["create"]["mutate"],
      TRPCClientSubset["member"]["create"]["mutate"]
    >;
    readonly update: M<
      TRPCClientSubset["member"]["update"]["mutate"],
      TRPCClientSubset["member"]["update"]["mutate"]
    >;
  };
  readonly frontingSession: {
    readonly create: M<
      TRPCClientSubset["frontingSession"]["create"]["mutate"],
      TRPCClientSubset["frontingSession"]["create"]["mutate"]
    >;
    readonly update: M<
      TRPCClientSubset["frontingSession"]["update"]["mutate"],
      TRPCClientSubset["frontingSession"]["update"]["mutate"]
    >;
  };
  readonly frontingComment: {
    readonly create: M<
      TRPCClientSubset["frontingComment"]["create"]["mutate"],
      TRPCClientSubset["frontingComment"]["create"]["mutate"]
    >;
    readonly update: M<
      TRPCClientSubset["frontingComment"]["update"]["mutate"],
      TRPCClientSubset["frontingComment"]["update"]["mutate"]
    >;
  };
  readonly note: {
    readonly create: M<
      TRPCClientSubset["note"]["create"]["mutate"],
      TRPCClientSubset["note"]["create"]["mutate"]
    >;
    readonly update: M<
      TRPCClientSubset["note"]["update"]["mutate"],
      TRPCClientSubset["note"]["update"]["mutate"]
    >;
  };
  readonly poll: {
    readonly create: M<
      TRPCClientSubset["poll"]["create"]["mutate"],
      TRPCClientSubset["poll"]["create"]["mutate"]
    >;
    readonly update: M<
      TRPCClientSubset["poll"]["update"]["mutate"],
      TRPCClientSubset["poll"]["update"]["mutate"]
    >;
    readonly castVote: M<
      TRPCClientSubset["poll"]["castVote"]["mutate"],
      TRPCClientSubset["poll"]["castVote"]["mutate"]
    >;
  };
  readonly channel: {
    readonly create: M<
      TRPCClientSubset["channel"]["create"]["mutate"],
      TRPCClientSubset["channel"]["create"]["mutate"]
    >;
    readonly update: M<
      TRPCClientSubset["channel"]["update"]["mutate"],
      TRPCClientSubset["channel"]["update"]["mutate"]
    >;
  };
  readonly message: {
    readonly create: M<
      TRPCClientSubset["message"]["create"]["mutate"],
      TRPCClientSubset["message"]["create"]["mutate"]
    >;
    readonly update: M<
      TRPCClientSubset["message"]["update"]["mutate"],
      TRPCClientSubset["message"]["update"]["mutate"]
    >;
  };
  readonly boardMessage: {
    readonly create: M<
      TRPCClientSubset["boardMessage"]["create"]["mutate"],
      TRPCClientSubset["boardMessage"]["create"]["mutate"]
    >;
    readonly update: M<
      TRPCClientSubset["boardMessage"]["update"]["mutate"],
      TRPCClientSubset["boardMessage"]["update"]["mutate"]
    >;
  };
  readonly group: {
    readonly create: M<
      TRPCClientSubset["group"]["create"]["mutate"],
      TRPCClientSubset["group"]["create"]["mutate"]
    >;
    readonly update: M<
      TRPCClientSubset["group"]["update"]["mutate"],
      TRPCClientSubset["group"]["update"]["mutate"]
    >;
    readonly addMember: M<
      TRPCClientSubset["group"]["addMember"]["mutate"],
      TRPCClientSubset["group"]["addMember"]["mutate"]
    >;
  };
  readonly blob: {
    readonly createUploadUrl: M<
      TRPCClientSubset["blob"]["createUploadUrl"]["mutate"],
      TRPCClientSubset["blob"]["createUploadUrl"]["mutate"]
    >;
    readonly confirmUpload: M<
      TRPCClientSubset["blob"]["confirmUpload"]["mutate"],
      TRPCClientSubset["blob"]["confirmUpload"]["mutate"]
    >;
  };
  readonly importEntityRef: {
    readonly lookupBatch: M<
      TRPCClientSubset["importEntityRef"]["lookupBatch"]["mutate"],
      TRPCClientSubset["importEntityRef"]["lookupBatch"]["mutate"]
    >;
    readonly upsertBatch: M<
      TRPCClientSubset["importEntityRef"]["upsertBatch"]["mutate"],
      TRPCClientSubset["importEntityRef"]["upsertBatch"]["mutate"]
    >;
  };
}

export function makeMockClient(): MockTRPCClient {
  return {
    system: { get: { query: vi.fn() }, update: { mutate: vi.fn() } },
    systemSettings: {
      settings: { get: { query: vi.fn() }, update: { mutate: vi.fn() } },
    },
    bucket: { create: { mutate: vi.fn() }, update: { mutate: vi.fn() } },
    field: {
      definition: { create: { mutate: vi.fn() }, update: { mutate: vi.fn() } },
      value: { set: { mutate: vi.fn() } },
    },
    customFront: { create: { mutate: vi.fn() }, update: { mutate: vi.fn() } },
    member: { create: { mutate: vi.fn() }, update: { mutate: vi.fn() } },
    frontingSession: { create: { mutate: vi.fn() }, update: { mutate: vi.fn() } },
    frontingComment: { create: { mutate: vi.fn() }, update: { mutate: vi.fn() } },
    note: { create: { mutate: vi.fn() }, update: { mutate: vi.fn() } },
    poll: {
      create: { mutate: vi.fn() },
      update: { mutate: vi.fn() },
      castVote: { mutate: vi.fn() },
    },
    channel: { create: { mutate: vi.fn() }, update: { mutate: vi.fn() } },
    message: { create: { mutate: vi.fn() }, update: { mutate: vi.fn() } },
    boardMessage: { create: { mutate: vi.fn() }, update: { mutate: vi.fn() } },
    group: {
      create: { mutate: vi.fn() },
      update: { mutate: vi.fn() },
      addMember: { mutate: vi.fn() },
    },
    blob: { createUploadUrl: { mutate: vi.fn() }, confirmUpload: { mutate: vi.fn() } },
    importEntityRef: { lookupBatch: { mutate: vi.fn() }, upsertBatch: { mutate: vi.fn() } },
  };
}
