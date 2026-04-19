import { z } from "zod";

/** Flat map of source-string key → translator context. */
export const ContextFileSchema = z.record(z.string().min(1), z.string().min(1));
export type ContextFile = z.infer<typeof ContextFileSchema>;

/**
 * All namespaces a context file may cover — must match filenames in
 * apps/mobile/locales/en/. Add a namespace here and create the matching
 * `<namespace>.context.json` whenever a new locale file ships with keys
 * worth authoring translator context for.
 */
export const CONTEXT_NAMESPACES = ["common"] as const;
export type ContextNamespace = (typeof CONTEXT_NAMESPACES)[number];
