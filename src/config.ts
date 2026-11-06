import "dotenv/config";
import { z } from "zod";

const configSchema = z.object({
  OPENROUTER_API_KEY: z.string().trim().min(1),
  LLM_MODEL: z.string().trim().min(1),
  PORT: z.coerce.number().int().min(1).max(65535).default(3001),
});

export function loadConfig() {
  const result = configSchema.safeParse(process.env);

  if (!result.success) {
    const fields = result.error.issues
      .map((issue) => issue.path.join("."))
      .join(", ");

    throw new Error(`Проверьте настройки окружения: ${fields}`);
  }

  return result.data;
}
