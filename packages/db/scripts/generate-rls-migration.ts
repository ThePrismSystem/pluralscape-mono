/**
 * Helper script to generate the static RLS migration SQL.
 * Run with: tsx scripts/generate-rls-migration.ts
 * Output goes to stdout — redirect to migration file.
 */

import { dropPolicySql, generateRlsStatements, RLS_TABLE_POLICIES } from "../src/rls/policies.js";

const lines: string[] = [];
lines.push("-- RLS policies for all tenant tables");
lines.push("-- Generated from RLS_TABLE_POLICIES in src/rls/policies.ts");
lines.push("");

for (const tableName of Object.keys(RLS_TABLE_POLICIES)) {
  lines.push(`-- ${tableName}`);
  const statements = generateRlsStatements(tableName);
  for (const stmt of statements) {
    const drop = dropPolicySql(stmt);
    if (drop) {
      lines.push(`${drop};`);
    }
    lines.push(`${stmt};`);
  }
  lines.push("");
}

console.info(lines.join("\n"));
