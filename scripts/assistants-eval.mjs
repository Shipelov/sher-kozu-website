#!/usr/bin/env node
/**
 * Ручной eval Маши против реального стека (сервер → Worker → Claude, инструменты
 * над живой БД). Не для CI. Ходит в SSE-эндпоинт запущенного сервера и пишет
 * markdown-отчёт: вопрос, ответ, вызванные инструменты, latency.
 *
 *   BASE_URL=http://localhost:3000 node scripts/assistants-eval.mjs [--out docs/assistants-eval.md] [--only 3,5]
 *
 * Сервер должен быть запущен с OPENAI_API_URL/OPENAI_API_KEY реального Worker.
 * Необязательно: EVAL_COOKIE — cookie авторизованного пользователя для сценариев владельца.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const SCENARIOS = [
  { id: 1, question: "Расскажи о ферме", expect: "get_farm_info; без списка животных, если не спрашивали" },
  { id: 2, question: "Сколько у вас пород?", expect: "list_animals; число пород из живого каталога" },
  { id: 3, question: "Чем знамениты лаконы?", expect: "search_knowledge; факты о породе, не шаблон" },
  { id: 4, question: "Сколько стоит половина козы?", expect: "list_animals + calculate_share/get_pricing_tiers; цена из БД" },
  { id: 5, question: "Что входит в стандартный тариф?", expect: "get_pricing_tiers; состав тарифа standard" },
  { id: 6, question: "Доставляете ли в Санкт-Петербург?", expect: "get_delivery_info; честный ответ по регионам" },
  { id: 7, question: "Какое молоко полезнее — козье или овечье?", expect: "мягкое перенаправление к Зое /nutritionist" },
  { id: 8, question: "Есть ли свободные коровы?", expect: "честное «коров нет», без выдумок" },
  { id: 9, question: "Кто такая Руфа?", expect: "list_animals/get_animal; профиль или честное «нет такой»" },
  { id: 10, question: "Как попасть на ферму?", expect: "get_farm_info/search_knowledge; визиты и клуб" },
];

const args = process.argv.slice(2);
const argValue = (name) => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
};
const baseUrl = (process.env.BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");
const outFile = path.resolve(argValue("--out") ?? `docs/assistants-eval-${new Date().toISOString().slice(0, 10)}.md`);
const only = argValue("--only")?.split(",").map((value) => Number(value.trim())).filter(Number.isFinite);
const sessionId = `eval-${Date.now()}`;

async function askMasha(question) {
  const startedAt = Date.now();
  const response = await fetch(`${baseUrl}/api/masha/chat/stream`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(process.env.EVAL_COOKIE ? { cookie: process.env.EVAL_COOKIE } : {}),
    },
    body: JSON.stringify({ messages: [{ role: "user", content: question }], sessionId, source: "faq" }),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);

  const decoder = new TextDecoder();
  let buffer = "";
  let reply = "";
  let outcome = "?";
  const tools = [];
  let firstChunkMs = null;
  for await (const chunk of response.body) {
    buffer += decoder.decode(chunk, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const data = line.slice(6).trim();
      if (data === "[DONE]") continue;
      let event;
      try {
        event = JSON.parse(data);
      } catch {
        continue;
      }
      if (event.type === "chunk") {
        if (firstChunkMs === null) firstChunkMs = Date.now() - startedAt;
        reply += event.content;
      } else if (event.type === "tool") tools.push(event.name);
      else if (event.type === "done") outcome = event.outcome;
    }
  }
  return { reply, tools, outcome, totalMs: Date.now() - startedAt, firstChunkMs };
}

async function main() {
  const scenarios = only?.length ? SCENARIOS.filter((scenario) => only.includes(scenario.id)) : SCENARIOS;
  const lines = [
    `# Eval Маши — ${new Date().toISOString()}`,
    "",
    `Сервер: ${baseUrl}. Сценариев: ${scenarios.length}. Оценка «ок/не ок» ставится вручную по колонке «Ожидание».`,
    "",
  ];
  for (const scenario of scenarios) {
    process.stdout.write(`[${scenario.id}] ${scenario.question} … `);
    let result;
    try {
      result = await askMasha(scenario.question);
      console.log(`${result.totalMs} мс, инструменты: ${result.tools.join(", ") || "—"}`);
    } catch (error) {
      console.log(`ошибка: ${error instanceof Error ? error.message : error}`);
      result = { reply: `ОШИБКА: ${error instanceof Error ? error.message : error}`, tools: [], outcome: "error", totalMs: 0, firstChunkMs: null };
    }
    lines.push(
      `## ${scenario.id}. ${scenario.question}`,
      "",
      `- Ожидание: ${scenario.expect}`,
      `- Инструменты: ${result.tools.join(", ") || "—"}`,
      `- Итог: ${result.outcome}; первый чанк ${result.firstChunkMs ?? "—"} мс, всего ${result.totalMs} мс`,
      `- Оценка: [ ] ок  [ ] не ок`,
      "",
      "> " + result.reply.trim().split("\n").join("\n> "),
      "",
    );
  }
  mkdirSync(path.dirname(outFile), { recursive: true });
  writeFileSync(outFile, lines.join("\n"));
  console.log(`Отчёт: ${outFile}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
