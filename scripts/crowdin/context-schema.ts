import { z } from "zod";

/** Flat map of source-string key → translator context. */
export const ContextFileSchema = z.record(z.string().min(1), z.string().min(1));
export type ContextFile = z.infer<typeof ContextFileSchema>;

/** All namespaces a context file may cover — must match filenames in apps/mobile/locales/en/. */
export const CONTEXT_NAMESPACES = ["common", "auth", "fronting", "members", "settings"] as const;
export type ContextNamespace = (typeof CONTEXT_NAMESPACES)[number];
