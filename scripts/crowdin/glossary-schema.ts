import { z } from "zod";

export const TermTypeSchema = z.enum(["translatable", "do-not-translate", "negative"]);
export const HazardSchema = z.enum(["critical", "medium", "low"]);

/**
 * Glossary part-of-speech values. Compound forms like "noun/verb" are
 * community-authored shorthand that we map to Crowdin's single-valued
 * PartOfSpeech enum via POS_MAPPING in glossary.ts.
 */
export const GlossaryPosSchema = z.enum(["adj", "noun", "verb", "noun/verb", "verb/noun"]);
export type GlossaryPos = z.infer<typeof GlossaryPosSchema>;

export const GlossaryTermSchema = z.object({
  term: z.string().min(1),
  type: TermTypeSchema,
  pos: GlossaryPosSchema.optional(),
  hazard: HazardSchema.optional(),
  loanword_ok: z.boolean().optional(),
  notes: z.string().min(1),
});

export const GlossarySchema = z
  .object({
    terms: z.array(GlossaryTermSchema).min(1),
  })
  .superRefine((data, ctx) => {
    const seen = new Set<string>();
    for (const [index, entry] of data.terms.entries()) {
      const key = entry.term.toLowerCase();
      if (seen.has(key)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["terms", index, "term"],
          message: `duplicate term: ${entry.term}`,
        });
      }
      seen.add(key);
    }
  });

export type GlossaryTerm = z.infer<typeof GlossaryTermSchema>;
export type Glossary = z.infer<typeof GlossarySchema>;
