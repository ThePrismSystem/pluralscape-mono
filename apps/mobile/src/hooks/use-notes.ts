import { trpc } from "@pluralscape/api-client/trpc";
import { decryptNote } from "@pluralscape/data/transforms/note";

import { rowToNote } from "../data/row-transforms.js";

import {
  useOfflineFirstQuery,
  useOfflineFirstInfiniteQuery,
  useDomainMutation,
} from "./factories.js";
import {
  DEFAULT_LIST_LIMIT,
  type DataListQuery,
  type DataQuery,
  type SystemIdOverride,
  type TRPCMutation,
} from "./types.js";

import type { RouterInput, RouterOutput } from "@pluralscape/api-client/trpc";
import type {
  NoteDecrypted,
  NotePage as NoteRawPage,
  NoteRaw,
} from "@pluralscape/data/transforms/note";
import type { Archived, NoteAuthorEntityType, NoteId } from "@pluralscape/types";

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
): DataQuery<NoteDecrypted | Archived<NoteDecrypted>> {
  return useOfflineFirstQuery<NoteRaw, NoteDecrypted | Archived<NoteDecrypted>>({
    queryKey: ["notes", noteId],
    table: "own_notes",
    entityId: noteId,
    rowTransform: rowToNote,
    decrypt: decryptNote,
    systemIdOverride: opts,
    useRemote: ({ systemId, enabled, select }) =>
      trpc.note.get.useQuery({ systemId, noteId }, { enabled, select }) as DataQuery<
        NoteDecrypted | Archived<NoteDecrypted>
      >,
  });
}

export function useNotesList(
  opts?: NoteListOpts,
): DataListQuery<NoteDecrypted | Archived<NoteDecrypted>> {
  return useOfflineFirstInfiniteQuery<NoteRaw, NoteDecrypted | Archived<NoteDecrypted>>({
    queryKey: [
      "notes",
      "list",
      opts?.includeArchived ?? false,
      opts?.authorEntityType,
      opts?.authorEntityId,
      opts?.systemWide ?? false,
    ],
    table: "own_notes",
    rowTransform: rowToNote,
    decrypt: decryptNote,
    includeArchived: opts?.includeArchived,
    systemIdOverride: opts,
    // Custom local query: note filters (authorEntityType, authorEntityId, systemWide)
    // are server-side only; local fallback returns all notes for the system
    localQueryFn: (localDb, systemId) => {
      const includeArchived = opts?.includeArchived ?? false;
      const sql = includeArchived
        ? "SELECT * FROM own_notes WHERE system_id = ? ORDER BY created_at DESC"
        : "SELECT * FROM own_notes WHERE system_id = ? AND archived = 0 ORDER BY created_at DESC";
      return localDb.queryAll(sql, [systemId]).map(rowToNote);
    },
    useRemote: ({ systemId, enabled, select }) =>
      trpc.note.list.useInfiniteQuery(
        {
          systemId,
          limit: opts?.limit ?? DEFAULT_LIST_LIMIT,
          includeArchived: opts?.includeArchived ?? false,
          authorEntityType: opts?.authorEntityType,
          authorEntityId: opts?.authorEntityId,
          systemWide: opts?.systemWide,
        },
        {
          enabled,
          getNextPageParam: (lastPage: NoteRawPage) => lastPage.nextCursor,
          select,
        },
      ) as DataListQuery<NoteDecrypted | Archived<NoteDecrypted>>,
  });
}

export function useCreateNote(): TRPCMutation<
  RouterOutput["note"]["create"],
  RouterInput["note"]["create"]
> {
  return useDomainMutation({
    useMutation: (mutOpts) => trpc.note.create.useMutation(mutOpts),
    onInvalidate: (utils, systemId) => {
      void utils.note.list.invalidate({ systemId });
    },
  });
}

export function useUpdateNote(): TRPCMutation<
  RouterOutput["note"]["update"],
  RouterInput["note"]["update"]
> {
  return useDomainMutation({
    useMutation: (mutOpts) => trpc.note.update.useMutation(mutOpts),
    onInvalidate: (utils, systemId, _data, variables) => {
      void utils.note.get.invalidate({ systemId, noteId: variables.noteId });
      void utils.note.list.invalidate({ systemId });
    },
  });
}

export function useArchiveNote(): TRPCMutation<
  RouterOutput["note"]["archive"],
  RouterInput["note"]["archive"]
> {
  return useDomainMutation({
    useMutation: (mutOpts) => trpc.note.archive.useMutation(mutOpts),
    onInvalidate: (utils, systemId, _data, variables) => {
      void utils.note.get.invalidate({ systemId, noteId: variables.noteId });
      void utils.note.list.invalidate({ systemId });
    },
  });
}

export function useRestoreNote(): TRPCMutation<
  RouterOutput["note"]["restore"],
  RouterInput["note"]["restore"]
> {
  return useDomainMutation({
    useMutation: (mutOpts) => trpc.note.restore.useMutation(mutOpts),
    onInvalidate: (utils, systemId, _data, variables) => {
      void utils.note.get.invalidate({ systemId, noteId: variables.noteId });
      void utils.note.list.invalidate({ systemId });
    },
  });
}

export function useDeleteNote(): TRPCMutation<
  RouterOutput["note"]["delete"],
  RouterInput["note"]["delete"]
> {
  return useDomainMutation({
    useMutation: (mutOpts) => trpc.note.delete.useMutation(mutOpts),
    onInvalidate: (utils, systemId, _data, variables) => {
      void utils.note.get.invalidate({ systemId, noteId: variables.noteId });
      void utils.note.list.invalidate({ systemId });
    },
  });
}
