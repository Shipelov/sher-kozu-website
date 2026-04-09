/**
 * Zoya Knowledge Base — File Upload Endpoint
 * Handles PDF/DOCX uploads, extracts text, analyzes via LLM,
 * checks for conflicts, and stores in knowledge base.
 */
import type { Express, Request, Response } from "express";
import { storagePut } from "./storage";
import { invokeLLM } from "./_core/llm";
import {
  createKnowledgeImport,
  updateKnowledgeImport,
  createKnowledge,
  searchKnowledge,
} from "./nutritionistDb";

// Auth check — reuse sdk.authenticateRequest from the existing auth system
async function getAdminUser(req: Request) {
  try {
    const { sdk } = await import("./_core/sdk");
    const user = await sdk.authenticateRequest(req as any);
    if (!user || user.role !== "admin") return null;
    return user;
  } catch {
    return null;
  }
}

/**
 * Extract text from uploaded file buffer based on MIME type.
 * For PDF: uses pdf-parse. For DOCX: uses mammoth. For TXT: direct decode.
 */
async function extractText(
  buffer: Buffer,
  mimeType: string,
  filename: string
): Promise<string> {
  if (
    mimeType === "application/pdf" ||
    filename.toLowerCase().endsWith(".pdf")
  ) {
    try {
      const pdfParse = (await import("pdf-parse")) as any;
      const result = await pdfParse(buffer);
      return result.text || "";
    } catch (err) {
      console.error("[NutriFileUpload] PDF parse error:", err);
      throw new Error("Не удалось распознать PDF файл");
    }
  }

  if (
    mimeType ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    filename.toLowerCase().endsWith(".docx")
  ) {
    try {
      const mammoth = await import("mammoth");
      const result = await mammoth.extractRawText({ buffer });
      return result.value || "";
    } catch (err) {
      console.error("[NutriFileUpload] DOCX parse error:", err);
      throw new Error("Не удалось распознать DOCX файл");
    }
  }

  if (
    mimeType === "text/plain" ||
    filename.toLowerCase().endsWith(".txt")
  ) {
    return buffer.toString("utf-8");
  }

  throw new Error(
    `Неподдерживаемый формат файла: ${mimeType}. Поддерживаются PDF, DOCX, TXT.`
  );
}

/**
 * Use LLM to analyze extracted text and produce structured knowledge entries.
 */
async function analyzeTextWithLLM(
  text: string,
  filename: string
): Promise<
  Array<{
    title: string;
    content: string;
    category: string;
    tags: string[];
    confidence: string;
  }>
> {
  const truncated = text.slice(0, 15000); // Limit to ~15k chars for LLM context

  const response = await invokeLLM({
    messages: [
      {
        role: "system",
        content: `Ты — AI-ассистент для анализа нутрициологических документов фермы "Шерь Козу".
Твоя задача — извлечь из текста ключевые факты о питании, здоровье, молочной продукции (козье/овечье молоко, сыры, йогурты, кефир, масло).

Верни JSON-массив объектов. Каждый объект — одна единица знания:
{
  "title": "Краткий заголовок факта (до 100 символов)",
  "content": "Подробное описание факта с цифрами и источниками (200-500 символов)",
  "category": одно из: "nutrition_science", "breed_profile", "product_info", "recipe", "health_goal", "general",
  "tags": ["тег1", "тег2"],
  "confidence": одно из: "verified" (научные данные), "trusted" (экспертное мнение), "unverified" (непроверенные данные)
}

Извлеки от 1 до 10 фактов. Если текст не содержит релевантной информации — верни пустой массив [].`,
      },
      {
        role: "user",
        content: `Файл: ${filename}\n\nТекст:\n${truncated}`,
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "knowledge_entries",
        strict: true,
        schema: {
          type: "object",
          properties: {
            entries: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  title: { type: "string" },
                  content: { type: "string" },
                  category: { type: "string" },
                  tags: { type: "array", items: { type: "string" } },
                  confidence: { type: "string" },
                },
                required: ["title", "content", "category", "tags", "confidence"],
                additionalProperties: false,
              },
            },
          },
          required: ["entries"],
          additionalProperties: false,
        },
      },
    },
  });

  try {
    const parsed = JSON.parse((response.choices[0].message.content as string) || "{}");
    return parsed.entries || [];
  } catch {
    console.error("[NutriFileUpload] Failed to parse LLM response");
    return [];
  }
}

/**
 * Check for conflicts between new entries and existing knowledge base.
 */
async function checkConflicts(
  entries: Array<{ title: string; content: string; category: string }>
): Promise<
  Array<{
    entryIndex: number;
    conflictWith: number;
    conflictTitle: string;
    reason: string;
  }>
> {
  const conflicts: Array<{
    entryIndex: number;
    conflictWith: number;
    conflictTitle: string;
    reason: string;
  }> = [];

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    // Search existing knowledge for similar content
    const existing = await searchKnowledge(entry.title, { limit: 5 });

    if (existing.length > 0) {
      // Use LLM to check if there's a real conflict
      const checkResponse = await invokeLLM({
        messages: [
          {
            role: "system",
            content: `Ты проверяешь, конфликтует ли новый факт с существующими в базе знаний.
Конфликт — это когда два факта противоречат друг другу (разные цифры, противоположные утверждения).
Дублирование — когда факты говорят об одном и том же.
Если конфликт или дублирование найдены, верни JSON: {"conflict": true, "reason": "описание конфликта", "existingId": ID_записи}
Если нет конфликта: {"conflict": false}`,
          },
          {
            role: "user",
            content: `Новый факт:\nЗаголовок: ${entry.title}\nСодержание: ${entry.content}\n\nСуществующие записи:\n${existing
              .map(
                (e) =>
                  `[ID=${e.id}] ${e.title}: ${e.content?.slice(0, 200)}`
              )
              .join("\n")}`,
          },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "conflict_check",
            strict: true,
            schema: {
              type: "object",
              properties: {
                conflict: { type: "boolean" },
                reason: { type: "string" },
                existingId: { type: "number" },
              },
              required: ["conflict", "reason", "existingId"],
              additionalProperties: false,
            },
          },
        },
      });

      try {
        const result = JSON.parse(
          (checkResponse.choices[0].message.content as string) || "{}"
        );
        if (result.conflict) {
          const conflicting = existing.find(
            (e) => e.id === result.existingId
          );
          conflicts.push({
            entryIndex: i,
            conflictWith: result.existingId || existing[0].id,
            conflictTitle: conflicting?.title || existing[0].title,
            reason: result.reason || "Возможный конфликт",
          });
        }
      } catch {
        // Skip conflict check if LLM response is invalid
      }
    }
  }

  return conflicts;
}

// Valid categories for the database enum
const VALID_CATEGORIES = [
  "nutrition_science",
  "breed_profile",
  "product_info",
  "recipe",
  "health_goal",
  "general",
];

type KnowledgeCategory = "nutrition_science" | "breed_profile" | "product_info" | "recipe" | "health_goal" | "general";

const VALID_CONFIDENCE = ["verified", "trusted", "unverified"];

type KnowledgeConfidence = "verified" | "trusted" | "unverified";

export function registerNutriFileUpload(app: Express) {
  // Multipart file upload endpoint
  app.post("/api/nutri/upload-file", async (req: Request, res: Response) => {
    try {
      // Check admin auth
      const admin = await getAdminUser(req);
      if (!admin) {
        return res.status(403).json({ error: "Доступ запрещён" });
      }

      // Read raw body as buffer (file is sent as raw binary with headers)
      const chunks: Buffer[] = [];
      for await (const chunk of req) {
        chunks.push(Buffer.from(chunk));
      }
      const buffer = Buffer.concat(chunks);

      if (buffer.length === 0) {
        return res.status(400).json({ error: "Файл не получен" });
      }

      if (buffer.length > 16 * 1024 * 1024) {
        return res
          .status(400)
          .json({ error: "Файл слишком большой (макс. 16 МБ)" });
      }

      const filename =
        (req.headers["x-filename"] as string) || "unknown_file";
      const mimeType =
        (req.headers["content-type"] as string) || "application/octet-stream";

      // 1. Create import record
      const importRecord = await createKnowledgeImport({
        sourceType: "file_upload",
        fileName: filename,
        sourceUrl: null,
        status: "processing",
      });

      // 2. Upload file to S3
      let fileUrl = "";
      try {
        const suffix = Math.random().toString(36).slice(2, 8);
        const key = `nutri-files/${importRecord.id}-${suffix}-${filename}`;
        const result = await storagePut(key, buffer, mimeType);
        fileUrl = result.url;
        await updateKnowledgeImport(importRecord.id, { sourceUrl: fileUrl });
      } catch (err) {
        console.error("[NutriFileUpload] S3 upload error:", err);
        // Continue without S3 — file is already in memory
      }

      // 3. Extract text
      let extractedText: string;
      try {
        extractedText = await extractText(buffer, mimeType, filename);
      } catch (err: any) {
        await updateKnowledgeImport(importRecord.id, {
          status: "rejected",
          // errorMessage: err.message,
        });
        return res
          .status(400)
          .json({ error: err.message, importId: importRecord.id });
      }

      if (!extractedText.trim()) {
        await updateKnowledgeImport(importRecord.id, {
          status: "rejected",
          // errorMessage: "Файл не содержит текста",
        });
        return res
          .status(400)
          .json({ error: "Файл не содержит текста", importId: importRecord.id });
      }

      await updateKnowledgeImport(importRecord.id, {
        // text extracted successfully
      });

      // 4. Analyze with LLM
      let entries;
      try {
        entries = await analyzeTextWithLLM(extractedText, filename);
      } catch (err: any) {
        await updateKnowledgeImport(importRecord.id, {
          status: "rejected",
          // errorMessage: "Ошибка анализа: " + (err.message || "unknown"),
        });
        return res.status(500).json({
          error: "Ошибка анализа файла",
          importId: importRecord.id,
        });
      }

      if (entries.length === 0) {
        await updateKnowledgeImport(importRecord.id, {
          status: "approved",
          factsExtracted: 0,
          factsNew: 0,
        });
        return res.json({
          importId: importRecord.id,
          status: "approved",
          factsExtracted: 0,
          factsNew: 0,
          conflicts: [],
          message: "Файл не содержит релевантной нутрициологической информации",
        });
      }

      // 5. Check conflicts
      let conflicts: Awaited<ReturnType<typeof checkConflicts>> = [];
      try {
        conflicts = await checkConflicts(entries);
      } catch (err) {
        console.error("[NutriFileUpload] Conflict check error:", err);
        // Continue without conflict checking
      }

      const conflictIndices = new Set(conflicts.map((c) => c.entryIndex));

      // 6. Add non-conflicting entries to knowledge base
      let added = 0;
      for (let i = 0; i < entries.length; i++) {
        if (conflictIndices.has(i)) continue;

        const entry = entries[i];
        const category = VALID_CATEGORIES.includes(entry.category)
          ? entry.category
          : "general_nutrition";
        const confidence = VALID_CONFIDENCE.includes(entry.confidence)
          ? entry.confidence
          : "medium";

        try {
          await createKnowledge({
            title: entry.title.slice(0, 255),
            content: entry.content,
            category: category as KnowledgeCategory,
            confidence: confidence as KnowledgeConfidence,
            sourceType: "file_upload" as const,
            sourceName: filename,
            sourceUrl: fileUrl || undefined,
            tags: entry.tags,
            status: "active" as const,
          });
          added++;
        } catch (err) {
          console.error(
            `[NutriFileUpload] Failed to create knowledge entry ${i}:`,
            err
          );
        }
      }

      // 7. Update import record
      await updateKnowledgeImport(importRecord.id, {
        status: conflicts.length > 0 ? "awaiting_review" as const : "approved" as const,
        factsExtracted: entries.length,
        factsNew: added,
        factsConflict: conflicts.length,
      });

      return res.json({
        importId: importRecord.id,
        status: conflicts.length > 0 ? "awaiting_review" as const : "approved" as const,
        factsExtracted: entries.length,
        factsNew: added,
        factsConflict: conflicts.length,
        conflicts: conflicts.map((c) => ({
          newEntry: entries[c.entryIndex].title,
          existingEntry: c.conflictTitle,
          existingId: c.conflictWith,
          reason: c.reason,
        })),
        message:
          conflicts.length > 0
            ? `Добавлено ${added} из ${entries.length} записей. ${conflicts.length} конфликт(ов) требуют ручного разрешения.`
            : `Успешно добавлено ${added} записей из файла "${filename}"`,
      });
    } catch (err: any) {
      console.error("[NutriFileUpload] Unexpected error:", err);
      return res
        .status(500)
        .json({ error: "Внутренняя ошибка сервера: " + (err.message || "") });
    }
  });

  // URL import endpoint
  app.post("/api/nutri/import-url", async (req: Request, res: Response) => {
    try {
      const admin = await getAdminUser(req);
      if (!admin) {
        return res.status(403).json({ error: "Доступ запрещён" });
      }

      const { url } = req.body;
      if (!url || typeof url !== "string") {
        return res.status(400).json({ error: "URL не указан" });
      }

      // Create import record
      const importRecord = await createKnowledgeImport({
        sourceType: "url_import",
        fileName: url,
        sourceUrl: url,
        status: "processing",
      });

      // Fetch URL content
      let text: string;
      try {
        const response = await fetch(url, {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (compatible; SherKozuBot/1.0; +https://koza.vip)",
          },
          signal: AbortSignal.timeout(15000),
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const html = await response.text();
        // Simple HTML to text extraction
        text = html
          .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
          .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
          .replace(/<[^>]+>/g, " ")
          .replace(/&nbsp;/g, " ")
          .replace(/&amp;/g, "&")
          .replace(/&lt;/g, "<")
          .replace(/&gt;/g, ">")
          .replace(/\s+/g, " ")
          .trim();
      } catch (err: any) {
        await updateKnowledgeImport(importRecord.id, {
          status: "rejected",
          // errorMessage: "Не удалось загрузить URL: " + err.message,
        });
        return res.status(400).json({
          error: "Не удалось загрузить URL: " + err.message,
          importId: importRecord.id,
        });
      }

      if (!text || text.length < 50) {
        await updateKnowledgeImport(importRecord.id, {
          status: "rejected",
          // errorMessage: "Страница не содержит достаточно текста",
        });
        return res.status(400).json({
          error: "Страница не содержит достаточно текста",
          importId: importRecord.id,
        });
      }

      await updateKnowledgeImport(importRecord.id, {
        // text extracted successfully
      });

      // Analyze with LLM
      let entries;
      try {
        entries = await analyzeTextWithLLM(text, url);
      } catch (err: any) {
        await updateKnowledgeImport(importRecord.id, {
          status: "rejected",
          // errorMessage: "Ошибка анализа: " + (err.message || "unknown"),
        });
        return res.status(500).json({
          error: "Ошибка анализа содержимого URL",
          importId: importRecord.id,
        });
      }

      if (entries.length === 0) {
        await updateKnowledgeImport(importRecord.id, {
          status: "approved",
          factsExtracted: 0,
          factsNew: 0,
        });
        return res.json({
          importId: importRecord.id,
          status: "approved",
          factsExtracted: 0,
          factsNew: 0,
          conflicts: [],
          message:
            "Страница не содержит релевантной нутрициологической информации",
        });
      }

      // Check conflicts
      let conflicts: Awaited<ReturnType<typeof checkConflicts>> = [];
      try {
        conflicts = await checkConflicts(entries);
      } catch {
        // Continue without conflict checking
      }

      const conflictIndices = new Set(conflicts.map((c) => c.entryIndex));

      // Add non-conflicting entries
      let added = 0;
      for (let i = 0; i < entries.length; i++) {
        if (conflictIndices.has(i)) continue;

        const entry = entries[i];
        const category = VALID_CATEGORIES.includes(entry.category)
          ? entry.category
          : "general_nutrition";
        const confidence = VALID_CONFIDENCE.includes(entry.confidence)
          ? entry.confidence
          : "medium";

        try {
          await createKnowledge({
            title: entry.title.slice(0, 255),
            content: entry.content,
            category: category as KnowledgeCategory,
            confidence: confidence as KnowledgeConfidence,
            sourceType: "url_import" as const,
            sourceName: new URL(url).hostname,
            sourceUrl: url,
            tags: entry.tags,
            status: "active" as const,
          });
          added++;
        } catch (err) {
          console.error(
            `[NutriFileUpload] Failed to create knowledge entry from URL:`,
            err
          );
        }
      }

      await updateKnowledgeImport(importRecord.id, {
        status: conflicts.length > 0 ? "awaiting_review" as const : "approved" as const,
        factsExtracted: entries.length,
        factsNew: added,
        factsConflict: conflicts.length,
      });

      return res.json({
        importId: importRecord.id,
        status: conflicts.length > 0 ? "awaiting_review" as const : "approved" as const,
        factsExtracted: entries.length,
        factsNew: added,
        factsConflict: conflicts.length,
        conflicts: conflicts.map((c) => ({
          newEntry: entries[c.entryIndex].title,
          existingEntry: c.conflictTitle,
          existingId: c.conflictWith,
          reason: c.reason,
        })),
        message:
          conflicts.length > 0
            ? `Добавлено ${added} из ${entries.length} записей. ${conflicts.length} конфликт(ов) требуют ручного разрешения.`
            : `Успешно добавлено ${added} записей с "${new URL(url).hostname}"`,
      });
    } catch (err: any) {
      console.error("[NutriFileUpload] URL import error:", err);
      return res
        .status(500)
        .json({ error: "Внутренняя ошибка сервера: " + (err.message || "") });
    }
  });
}
