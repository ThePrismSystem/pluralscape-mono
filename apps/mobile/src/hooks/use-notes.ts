import { trpc } from "@pluralscape/api-client/trpc";
import { decryptNote, decryptNotePage } from "@pluralscape/data/transforms/note";

import { useMasterKey } from "../providers/crypto-provider.js";
import { useActiveSystemId } from "../providers/system-provider.js";

import {
  DEFAULT_LIST_LIMIT,
  type SystemIdOverride,
  type TRPCInfiniteQuery,
  type TRPCMutation,
  type TRPCQuery,
} from "./types.js";

import type { RouterInput, RouterOutput } from "@pluralscape/api-client/trpc";
import type { NoteDecrypted } from "@pluralscape/data/transforms/note";
import type { Archived, NoteAuthorEntityType, NoteId } from "@pluralscape/types";
import type { InfiniteData } from "@tanstack/react-query";

type RawNote = RouterOutput["note"]["get"];
type RawNotePage = RouterOutput["note"]["list"];
type NotePage = {
  readonly data: (NoteDecrypted | Archived<NoteDecrypted>)[];
  readonly nextCursor: string | null;
};

interface NoteListOpts extends SystemIdOverride {
  readonly limit?: number;
  readonly includeArchived?: boolean;
  readonly authorEntityType?: NoteAuthorEntityType;
  readonly authorEntityId?: string;
  readonly systemWide?: boolean;
}

export function useNote(
  noteId: NoteId,
  opts?: SystemIdOverride,
): TRPCQuery<NoteDecrypted | Archived<NoteDecrypted>> {
  const activeSystemId = useActiveSystemId();
  const systemId = opts?.systemId ?? activeSystemId;
  const masterKey = useMasterKey();

  return trpc.note.get.useQuery(
    { systemId, noteId },
    {
      enabled: masterKey !== null,
      select: (raw: RawNote): NoteDecrypted | Archived<NoteDecrypted> => {
        if (masterKey === null) throw new Error("masterKey is null");
        return decryptNote(raw, masterKey);
      },
    },
  );
}

export function useNotesList(opts?: NoteListOpts): TRPCInfiniteQuery<NotePage> {
  const activeSystemId = useActiveSystemId();
  const systemId = opts?.systemId ?? activeSystemId;
  const masterKey = useMasterKey();

  return trpc.note.list.useInfiniteQuery(
    {
      systemId,
      limit: opts?.limit ?? DEFAULT_LIST_LIMIT,
      includeArchived: opts?.includeArchived ?? false,
      authorEntityType: opts?.authorEntityType,
      authorEntityId: opts?.authorEntityId,
      systemWide: opts?.systemWide,
    },
    {
      enabled: masterKey !== null,
      getNextPageParam: (lastPage: RawNotePage) => lastPage.nextCursor,
      select: (data: InfiniteData<RawNotePage>): InfiniteData<NotePage> => {
        if (masterKey === null) throw new Error("masterKey is null");
        const key = masterKey;
        return {
          ...data,
          pages: data.pages.map((page) => decryptNotePage(page, key)),
        };
      },
    },
  );
}

export function useCreateNote(): TRPCMutation<
  RouterOutput["note"]["create"],
  RouterInput["note"]["create"]
> {
  const systemId = useActiveSystemId();
  const utils = trpc.useUtils();

  return trpc.note.create.useMutation({
    onSuccess: () => {
      void utils.note.list.invalidate({ systemId });
    },
  });
}

export function useUpdateNote(): TRPCMutation<
  RouterOutput["note"]["update"],
  RouterInput["note"]["update"]
> {
  const systemId = useActiveSystemId();
  const utils = trpc.useUtils();

  return trpc.note.update.useMutation({
    onSuccess: (_data, variables) => {
      void utils.note.get.invalidate({ systemId, noteId: variables.noteId });
      void utils.note.list.invalidate({ systemId });
    },
  });
}

export function useArchiveNote(): TRPCMutation<
  RouterOutput["note"]["archive"],
  RouterInput["note"]["archive"]
> {
  const systemId = useActiveSystemId();
  const utils = trpc.useUtils();

  return trpc.note.archive.useMutation({
    onSuccess: (_data, variables) => {
      void utils.note.get.invalidate({ systemId, noteId: variables.noteId });
      void utils.note.list.invalidate({ systemId });
    },
  });
}

export function useRestoreNote(): TRPCMutation<
  RouterOutput["note"]["restore"],
  RouterInput["note"]["restore"]
> {
  const systemId = useActiveSystemId();
  const utils = trpc.useUtils();

  return trpc.note.restore.useMutation({
    onSuccess: (_data, variables) => {
      void utils.note.get.invalidate({ systemId, noteId: variables.noteId });
      void utils.note.list.invalidate({ systemId });
    },
  });
}

export function useDeleteNote(): TRPCMutation<
  RouterOutput["note"]["delete"],
  RouterInput["note"]["delete"]
> {
  const systemId = useActiveSystemId();
  const utils = trpc.useUtils();

  return trpc.note.delete.useMutation({
    onSuccess: (_data, variables) => {
      void utils.note.get.invalidate({ systemId, noteId: variables.noteId });
      void utils.note.list.invalidate({ systemId });
    },
  });
}
