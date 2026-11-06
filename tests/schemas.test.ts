import { describe, expect, it } from "vitest";
import { llmOutputSchema } from "../src/schemas.js";

describe("Ответ модели", () => {
  const draft = {
    status: "draft",
    seo_title: "Манометр DM 02",
    seo_description: "а".repeat(800),
    search_queries: [
      "манометр DM 02",
      "манометр Манотомь",
      "манометр для измерения давления",
    ],
    commercial_block: "Для задач измерения давления.",
    questions: [],
    warnings: [],
  };

  it.each([70, 71])("проверяет заголовок длиной %i символов", (length) => {
    const result = llmOutputSchema.safeParse({
      ...draft,
      seo_title: "а".repeat(length),
    });

    expect(result.success).toBe(length <= 70);
  });

  it.each([799, 800, 1200, 1201])(
    "проверяет описание длиной %i символов",
    (length) => {
      const result = llmOutputSchema.safeParse({
        ...draft,
        seo_description: "а".repeat(length),
      });

      expect(result.success).toBe(length >= 800 && length <= 1200);
    },
  );

  it("принимает запрос уточнений без выдуманной карточки", () => {
    const result = llmOutputSchema.safeParse({
      status: "needs_input",
      questions: ["Для каких измерений предназначен прибор?"],
      warnings: ["Недостаточно исходных сведений о назначении."],
    });

    expect(result.success).toBe(true);
  });
});
