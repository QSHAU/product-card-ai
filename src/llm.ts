import { z } from "zod";

export type LlmMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

type LlmRequest = {
  apiKey: string;
  model: string;
  messages: LlmMessage[];
  maxTokens?: number;
};

const responseSchema = z.object({
  choices: z
    .array(
      z.object({
        message: z.object({
          content: z.string().trim().min(1),
        }),
      }),
    )
    .min(1),
});

export async function requestLlm(options: LlmRequest): Promise<string> {
  const response = await fetch(
    "https://openrouter.ai/api/v1/chat/completions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${options.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: options.model,
        messages: options.messages,
        max_tokens: options.maxTokens ?? 2000,
        reasoning: {
          enabled: false,
        },
      }),
      signal: AbortSignal.timeout(30_000),
    },
  );

  if (!response.ok) {
    const errorBody: unknown = await response.json().catch(() => null);

    const errorResult = z
      .object({
        error: z.object({
          message: z.string(),
        }),
      })
      .safeParse(errorBody);

    const details = errorResult.success
      ? errorResult.data.error.message
      : "Сервис не вернул пояснение в ожидаемом формате";

    throw new Error(`OpenRouter вернул HTTP ${response.status}: ${details}`);
  }

  const body: unknown = await response.json();
  const result = responseSchema.safeParse(body);

  if (!result.success) {
    throw new Error("OpenRouter вернул ответ без ожидаемого текста");
  }

  return result.data.choices[0].message.content;
}
