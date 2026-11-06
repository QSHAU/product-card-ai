import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { GenerateText } from "../src/service.js";
import { buildApp } from "../src/app.js";

describe("POST /generate: проверка входных данных", () => {
  let app: ReturnType<typeof buildApp>;

  const modelDraft = {
    status: "draft",
    seo_title: "Манометр DM 02",
    seo_description: "а".repeat(800),
    search_queries: [
      "манометр DM 02",
      "манометр Манотомь",
      "измерение давления",
    ],
    commercial_block: "Для задач измерения давления.",
    questions: [],
    warnings: [],
  };

  const generateText = vi.fn<GenerateText>();

  beforeEach(() => {
    generateText.mockReset();
    generateText.mockResolvedValue(JSON.stringify(modelDraft));

    app = buildApp({ generateText });
  });

  afterEach(async () => {
    await app.close();
  });

  it("принимает товар и сохраняет технические значения", async () => {
    const product = {
      name: "Манометр DM 02",
      manufacturer: "Манотомь",
      specs: {
        "диапазон измерений": "0–1,6 МПа",
        "класс точности": "1,5",
        "нижняя граница": 0,
      },
      description: "Прибор для измерения избыточного давления.",
    };

    const response = await app.inject({
      method: "POST",
      url: "/generate",
      payload: product,
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      ...modelDraft,
      characteristics: [
        {
          name: "диапазон измерений",
          value: "0–1,6 МПа",
        },
        {
          name: "класс точности",
          value: "1,5",
        },
        {
          name: "нижняя граница",
          value: "0",
        },
      ],
      missing_fields: [],
    });

    expect(generateText).toHaveBeenCalledTimes(1);
  });

  it("отклоняет строку вместо объекта характеристик", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/generate",
      payload: { specs: "wrong" },
    });

    expect(response.statusCode).toBe(422);
    expect(response.json()).toMatchObject({
      error: "INVALID_INPUT",
      issues: [
        {
          field: "specs",
        },
      ],
    });
    expect(generateText).not.toHaveBeenCalled();
  });

  it("сообщает о нехватке данных для пустого объекта", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/generate",
      payload: {},
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      status: "needs_input",
      seo_title: null,
      seo_description: null,
      characteristics: [],
      missing_fields: ["name", "manufacturer", "description", "specs"],
    });
    expect(generateText).not.toHaveBeenCalled();
  });

  it("отклоняет неизвестные поля", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/generate",
      payload: {
        name: "Манометр",
        manufactuer: "Опечатка в названии поля",
      },
    });

    expect(response.statusCode).toBe(422);
    expect(response.json().error).toBe("INVALID_INPUT");
    expect(generateText).not.toHaveBeenCalled();
  });

  it("возвращает уточнения, если модель считает данные недостаточными", async () => {
    generateText.mockResolvedValueOnce(
      JSON.stringify({
        status: "needs_input",
        questions: ["Каков диапазон измерений прибора?"],
        warnings: ["Недостаточно технических сведений."],
      }),
    );

    const response = await app.inject({
      method: "POST",
      url: "/generate",
      payload: {
        name: "Манометр",
        description: "Прибор для измерения давления.",
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      status: "needs_input",
      seo_title: null,
      seo_description: null,
      characteristics: [],
      search_queries: [],
      commercial_block: null,
      missing_fields: ["manufacturer", "specs"],
      questions: ["Каков диапазон измерений прибора?"],
      warnings: ["Недостаточно технических сведений."],
    });

    expect(generateText).toHaveBeenCalledTimes(1);
  });

  it("возвращает понятную ошибку при сбое генерации", async () => {
    generateText.mockRejectedValueOnce(
      new Error("Внутренние подробности сбоя провайдера"),
    );

    const response = await app.inject({
      method: "POST",
      url: "/generate",
      payload: {
        name: "Манометр",
        description: "Прибор для измерения давления.",
      },
    });

    expect(response.statusCode).toBe(502);
    expect(response.json()).toEqual({
      error: "GENERATION_FAILED",
      message: "Не удалось получить корректный черновик карточки",
    });
  });

  it("возвращает 400 при синтаксически некорректном JSON", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/generate",
      headers: {
        "content-type": "application/json",
      },
      payload: '{"name":',
    });

    expect(response.statusCode).toBe(400);
    expect(generateText).not.toHaveBeenCalled();
  });

  it("помечает пустые характеристики и сохраняет числовой ноль", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/generate",
      payload: {
        name: "Манометр",
        manufacturer: "Манотомь",
        description: "Прибор для измерения давления.",
        specs: {
          "класс точности": null,
          питание: "   ",
          "нижняя граница": 0,
        },
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      status: "draft",
      characteristics: [
        { name: "класс точности", value: "данных нет" },
        { name: "питание", value: "данных нет" },
        { name: "нижняя граница", value: "0" },
      ],
      missing_fields: ["specs.класс точности", "specs.питание"],
    });
    expect(generateText).toHaveBeenCalledTimes(1);
  });
});
