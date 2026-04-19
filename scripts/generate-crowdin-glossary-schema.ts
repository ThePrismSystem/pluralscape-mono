import { writeFileSync } from "node:fs";
import path from "node:path";

import { z } from "zod";

import { GlossarySchema } from "./crowdin/glossary-schema.js";

const jsonSchema = z.toJSONSchema(GlossarySchema, { target: "draft-7" });

const out = path.resolve(import.meta.dirname, "crowdin-glossary.schema.json");
writeFileSync(out, `${JSON.stringify(jsonSchema, null, 2)}\n`);
console.log(`Wrote ${out}`);
