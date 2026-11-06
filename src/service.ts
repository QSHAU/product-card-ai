import {
  llmOutputSchema,
  type LlmOutput,
  type ProductInput,
} from "./schemas.js";
import type { LlmMessage } from "./llm.js";
import { buildProductMessages } from "./prompts.js";

export type GenerateText = (messages: LlmMessage[]) => Promise<string>;
class InvalidLlmOutputError extends Error {}

export function assessProduct(product: ProductInput) {
  const missingFields: string[] = [];

  if (!product.name) missingFields.push("name");
  if (!product.manufacturer) missingFields.push("manufacturer");
  if (!product.description) missingFields.push("description");

  const entries = Object.entries(product.specs);

  if (entries.length === 0) {
    missingFields.push("specs");
  }

  let knownSpecsCount = 0;

  const characteristics = entries.map(([name, value]) => {
    const isMissing = value === null || value === "";

    if (isMissing) {
      missingFields.push(`specs.${name}`);
    } else {
      knownSpecsCount += 1;
    }

    return {
      name,
      value: isMissing ? "данных нет" : String(value),
    };
  });

  const hasFacts = product.description.length > 0 || knownSpecsCount > 0;

  return {
    canGenerate: product.name.length > 0 && hasFacts,
    missingFields,
    characteristics,
  };
}

function parseLlmOutput(text: string): LlmOutput {
  let parsed: unknown;

  try {
    parsed = JSON.parse(text);
  } catch {
    throw new InvalidLlmOutputError("Ответ модели не является корректным JSON");
  }

  const result = llmOutputSchema.safeParse(parsed);

  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => {
        const field = issue.path.map(String).join(".") || "body";
        return `${field}: ${issue.message}`;
      })
      .join("; ");

    throw new InvalidLlmOutputError(
      `Ответ модели не соответствует схеме: ${issues}`,
    );
  }

  return result.data;
}

export async function generateCardDraft(
  product: ProductInput,
  generateText: GenerateText,
): Promise<LlmOutput> {
  const messages = buildProductMessages(product);
  const text = await generateText(messages);

  try {
    return parseLlmOutput(text);
  } catch (error) {
    if (!(error instanceof InvalidLlmOutputError)) {
      throw error;
    }

    const retryMessages: LlmMessage[] = [
      ...messages,
      {
        role: "assistant",
        content: text,
      },
      {
        role: "user",
        content: [
          "Предыдущий ответ не прошёл проверку.",
          error.message,
          "Верни исправленный JSON целиком, без Markdown.",
          "Продолжай использовать только исходные факты.",
          "Не добавляй характеристики и обещания ради длины.",
          "Если фактов недостаточно, верни needs_input",
          "с конкретными вопросами и предупреждениями.",
          "Если нарушена длина seo_description, перепиши описание целиком.",
          "Целевой объём описания около 1000 символов, допустимо 800–1200.",
          "Если нарушена длина seo_title, сократи его до 40–55 символов.",
          "Сохрани обозначение модели и производителя; сокращай общие слова.",
        ].join("\n"),
      },
    ];

    const correctedText = await generateText(retryMessages);

    return parseLlmOutput(correctedText);
  }
}
