import type { StructureCrossLink } from "./types.js";

export interface RawCrossLinkRow {
  readonly id: string;
  readonly system_id: string;
  readonly link_type: string;
  readonly source_id: string;
  readonly target_id: string;
  readonly created_at: string | number;
}

export function mapCrossLinkRow(r: RawCrossLinkRow): StructureCrossLink {
  return {
    id: r.id,
    systemId: r.system_id,
    linkType: r.link_type as StructureCrossLink["linkType"],
    sourceId: r.source_id,
    targetId: r.target_id,
    createdAt: typeof r.created_at === "number" ? r.created_at : new Date(r.created_at).getTime(),
  };
}
