/** DB-level actor type — uses plain string IDs (branded types are an app-layer concern). */
export type DbAuditActor =
  | { readonly kind: "account"; readonly id: string }
  | { readonly kind: "api-key"; readonly id: string }
  | { readonly kind: "system"; readonly id: string };
