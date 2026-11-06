import { describe, expect, it, vi } from "vitest";
import { productInputSchema } from "../src/schemas.js";
import { generateCardDraft, type GenerateText } from "../src/service.js";

describe("Генерация черновика", () => {
  const product = productInputSchema.parse({
    name: "Манометр",
    description: "Прибор для измерения избыточного давления.",
  });

  const draft = {
    status: "draft",
    seo_title: "Манометр для измерения давления",
    seo_description: "а".repeat(800),
    search_queries: ["манометр", "измерение давления", "манометр для давления"],
    commercial_block: "Для задач измерения давления.",
    questions: [],
    warnings: [],
  };

  it("возвращает проверенный ответ модели", async () => {
    const generateText = async () => JSON.stringify(draft);

    const result = await generateCardDraft(product, generateText);

    expect(result).toEqual(draft);
  });

  it("отклоняет ответ, который не является JSON", async () => {
    const generateText = async () => "Вот ваша карточка товара";

    await expect(generateCardDraft(product, generateText)).rejects.toThrow(
      "Ответ модели не является корректным JSON",
    );
  });

  it("отклоняет JSON с нарушением ограничений карточки", async () => {
    const generateText = async () =>
      JSON.stringify({
        ...draft,
        seo_description: "Слишком короткое описание.",
      });

    await expect(generateCardDraft(product, generateText)).rejects.toThrow(
      "Ответ модели не соответствует схеме",
    );
  });

  it("исправляет ответ после нарушения длины", async () => {
    const generateText = vi
      .fn<GenerateText>()
      .mockResolvedValueOnce(
        JSON.stringify({
          ...draft,
          seo_description: "Короткое описание.",
        }),
      )
      .mockResolvedValueOnce(JSON.stringify(draft));

    const result = await generateCardDraft(product, generateText);

    expect(result).toEqual(draft);
    expect(generateText).toHaveBeenCalledTimes(2);
  });

  it("останавливается после второго некорректного ответа", async () => {
    const generateText = vi.fn<GenerateText>().mockResolvedValue("Не JSON");

    await expect(generateCardDraft(product, generateText)).rejects.toThrow(
      "Ответ модели не является корректным JSON",
    );

    expect(generateText).toHaveBeenCalledTimes(2);
  });

  it("не запускает исправление при ошибке API", async () => {
    const generateText = vi
      .fn<GenerateText>()
      .mockRejectedValue(new Error("API недоступен"));

    await expect(generateCardDraft(product, generateText)).rejects.toThrow(
      "API недоступен",
    );

    expect(generateText).toHaveBeenCalledTimes(1);
  });
});
