import { z } from "zod";

export const TermTypeSchema = z.enum(["translatable", "do-not-translate", "negative"]);
export const HazardSchema = z.enum(["critical", "medium", "low"]);

export const GlossaryTermSchema = z.object({
  term: z.string().min(1),
  type: TermTypeSchema,
  pos: z.string().min(1).optional(),
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
