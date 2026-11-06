import { productInputSchema } from "./schemas.js";
import Fastify from "fastify";
import {
  assessProduct,
  generateCardDraft,
  type GenerateText,
} from "./service.js";

export function buildApp({ generateText }: { generateText: GenerateText }) {
  const app = Fastify({
    logger: true,
  });

  app.get("/health", async () => {
    return { status: "ok" };
  });

  app.post("/generate", async (request, reply) => {
    const result = productInputSchema.safeParse(request.body);

    if (!result.success) {
      return reply.code(422).send({
        error: "INVALID_INPUT",
        message: "Проверьте данные товара",
        issues: result.error.issues.map((issue) => ({
          field: issue.path.map(String).join(".") || "body",
          message: issue.message,
        })),
      });
    }

    const assessment = assessProduct(result.data);

    if (!assessment.canGenerate) {
      return {
        status: "needs_input",
        seo_title: null,
        seo_description: null,
        characteristics: assessment.characteristics,
        search_queries: [],
        commercial_block: null,
        missing_fields: assessment.missingFields,
        questions: [],
        warnings: [
          "Нужны название товара и описание или хотя бы одна непустая характеристика.",
        ],
      };
    }

    try {
      const generated = await generateCardDraft(result.data, generateText);

      if (generated.status === "needs_input") {
        return {
          status: "needs_input",
          seo_title: null,
          seo_description: null,
          characteristics: assessment.characteristics,
          search_queries: [],
          commercial_block: null,
          missing_fields: assessment.missingFields,
          questions: generated.questions,
          warnings: generated.warnings,
        };
      }

      return {
        ...generated,
        characteristics: assessment.characteristics,
        missing_fields: assessment.missingFields,
      };
    } catch (error) {
      request.log.error({ err: error }, "Ошибка генерации карточки");

      return reply.code(502).send({
        error: "GENERATION_FAILED",
        message: "Не удалось получить корректный черновик карточки",
      });
    }
  });

  return app;
}
