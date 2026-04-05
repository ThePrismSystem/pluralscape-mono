import { trpc } from "@pluralscape/api-client/trpc";
import { decryptNote, decryptNotePage } from "@pluralscape/data/transforms/note";
import { useQuery } from "@tanstack/react-query";
import { useCallback } from "react";

import { rowToNote } from "../data/row-transforms.js";
import { useMasterKey } from "../providers/crypto-provider.js";
import { useActiveSystemId } from "../providers/system-provider.js";

import {
  DEFAULT_LIST_LIMIT,
  type DataListQuery,
  type DataQuery,
  type SystemIdOverride,
  type TRPCMutation,
} from "./types.js";
import { useLocalDb, useQuerySource } from "./use-query-source.js";

import type { RouterInput, RouterOutput } from "@pluralscape/api-client/trpc";
import type {
  NoteDecrypted,
  NotePage as NoteRawPage,
  NoteRaw,
} from "@pluralscape/data/transforms/note";
import type { Archived, NoteAuthorEntityType, NoteId } from "@pluralscape/types";
import type { InfiniteData } from "@tanstack/react-query";

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
): DataQuery<NoteDecrypted | Archived<NoteDecrypted>> {
  const source = useQuerySource();
  const localDb = useLocalDb();
  const activeSystemId = useActiveSystemId();
  const systemId = opts?.systemId ?? activeSystemId;
  const masterKey = useMasterKey();

  const selectNote = useCallback(
    (raw: NoteRaw): NoteDecrypted | Archived<NoteDecrypted> => {
      if (masterKey === null) throw new Error("masterKey is null");
      return decryptNote(raw, masterKey);
    },
    [masterKey],
  );

  const localQuery = useQuery({
    queryKey: ["notes", noteId],
    queryFn: () => {
      if (localDb === null) throw new Error("localDb is null");
      const row = localDb.queryOne("SELECT * FROM own_notes WHERE id = ?", [noteId]);
      if (!row) throw new Error("Note not found");
      return rowToNote(row);
    },
    enabled: source === "local",
  });

  const remoteQuery = trpc.note.get.useQuery(
    { systemId, noteId },
    {
      enabled: source === "remote" && masterKey !== null,
      select: selectNote,
    },
  );

  return source === "local" ? localQuery : remoteQuery;
}

export function useNotesList(
  opts?: NoteListOpts,
): DataListQuery<NoteDecrypted | Archived<NoteDecrypted>> {
  const source = useQuerySource();
  const localDb = useLocalDb();
  const activeSystemId = useActiveSystemId();
  const systemId = opts?.systemId ?? activeSystemId;
  const masterKey = useMasterKey();

  const selectNotePage = useCallback(
    (data: InfiniteData<NoteRawPage>): InfiniteData<NotePage> => {
      if (masterKey === null) throw new Error("masterKey is null");
      const key = masterKey;
      return {
        ...data,
        pages: data.pages.map((page) => decryptNotePage(page, key)),
      };
    },
    [masterKey],
  );

  const localQuery = useQuery({
    queryKey: [
      "notes",
      "list",
      systemId,
      opts?.includeArchived ?? false,
      opts?.authorEntityType,
      opts?.authorEntityId,
      opts?.systemWide ?? false,
    ],
    queryFn: () => {
      if (localDb === null) throw new Error("localDb is null");
      const includeArchived = opts?.includeArchived ?? false;
      const sql = includeArchived
        ? "SELECT * FROM own_notes WHERE system_id = ?"
        : "SELECT * FROM own_notes WHERE system_id = ? AND archived = 0";
      return localDb.queryAll(sql, [systemId]).map(rowToNote);
    },
    enabled: source === "local",
  });

  const remoteQuery = trpc.note.list.useInfiniteQuery(
    {
      systemId,
      limit: opts?.limit ?? DEFAULT_LIST_LIMIT,
      includeArchived: opts?.includeArchived ?? false,
      authorEntityType: opts?.authorEntityType,
      authorEntityId: opts?.authorEntityId,
      systemWide: opts?.systemWide,
    },
    {
      enabled: source === "remote" && masterKey !== null,
      getNextPageParam: (lastPage: NoteRawPage) => lastPage.nextCursor,
      select: selectNotePage,
    },
  );

  return source === "local" ? localQuery : remoteQuery;
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
