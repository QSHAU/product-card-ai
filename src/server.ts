import { buildApp } from "./app.js";
import { loadConfig } from "./config.js";
import { requestLlm } from "./llm.js";

async function start() {
  const config = loadConfig();
  const app = buildApp({
    generateText: (messages) =>
      requestLlm({
        apiKey: config.OPENROUTER_API_KEY,
        model: config.LLM_MODEL,
        messages,
      }),
  });

  try {
    await app.listen({
      port: config.PORT,
      host: "127.0.0.1",
    });
  } catch (error) {
    app.log.error(error);
    process.exitCode = 1;
  }
}

start().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Ошибка запуска");

  process.exitCode = 1;
});
