import type { StructureEntityAssociationRow } from "./types.js";

export interface RawStructureEntityAssociationRow {
  readonly id: string;
  readonly system_id: string;
  readonly source_entity_id: string;
  readonly target_entity_id: string;
  readonly created_at: string | number;
}

export function mapStructureEntityAssociationRow(
  r: RawStructureEntityAssociationRow,
): StructureEntityAssociationRow {
  return {
    id: r.id,
    systemId: r.system_id,
    sourceEntityId: r.source_entity_id,
    targetEntityId: r.target_entity_id,
    createdAt: typeof r.created_at === "number" ? r.created_at : new Date(r.created_at).getTime(),
  };
}
