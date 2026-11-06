import { z } from "zod";

const specValueSchema = z.union([
  z.string().trim().max(1000),
  z.number(),
  z.null(),
]);

const specsSchema = z
  .record(
    z.string().min(1).max(120).regex(/\S/, "Название параметра пустое"),
    specValueSchema,
  )
  .refine(
    (specs) => Object.keys(specs).length <= 100,
    "Допускается не более 100 характеристик",
  );

export const productInputSchema = z.strictObject({
  name: z.string().trim().max(300).default(""),
  manufacturer: z.string().trim().max(300).default(""),
  specs: specsSchema.default({}),
  description: z.string().trim().max(20_000).default(""),
});

function boundedText(min: number, max: number) {
  return z
    .string()
    .trim()
    .superRefine((value, context) => {
      const length = Array.from(value).length;

      if (length < min || length > max) {
        context.addIssue({
          code: "custom",
          message: `Требуется от ${min} до ${max} символов; получено ${length}`,
        });
      }
    });
}

const questionSchema = boundedText(1, 500);
const warningSchema = boundedText(1, 500);

const draftSchema = z.strictObject({
  status: z.literal("draft"),
  seo_title: boundedText(1, 70),
  seo_description: boundedText(800, 1200),
  search_queries: z.array(boundedText(1, 150)).min(3).max(5),
  commercial_block: boundedText(1, 1500),
  questions: z.array(questionSchema).max(10),
  warnings: z.array(warningSchema).max(10),
});

const needsInputSchema = z.strictObject({
  status: z.literal("needs_input"),
  questions: z.array(questionSchema).min(1).max(10),
  warnings: z.array(warningSchema).min(1).max(10),
});

export const llmOutputSchema = z.discriminatedUnion("status", [
  draftSchema,
  needsInputSchema,
]);

export type LlmOutput = z.infer<typeof llmOutputSchema>;

export type ProductInput = z.infer<typeof productInputSchema>;
