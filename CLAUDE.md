# koza.vip («Шерь Козу») — правила работы для Claude Code

Клуб персонального фермерства: маркетплейс долей животных, кабинеты владельцев,
АРМ фермы, AI-ассистенты Зоя (нутрициолог) и Маша (управляющая фермой).
Прочитай `HANDOVER.md` перед первой задачей — там описана инфраструктура.

## Стек (фактический, не путать с ранними документами)

- Frontend: Vite + React 19 + TypeScript, Wouter (роутинг), TanStack Query, tRPC 11, Tailwind, shadcn/ui
- Backend: Node 22, Express, tRPC 11, Drizzle ORM, TiDB Cloud (MySQL-диалект)
- LLM: OpenAI-совместимый клиент `server/_core/llm.ts` → Cloudflare Worker `cloudflare/tg-proxy`
- Деплой: push в `main` → `.github/workflows/deploy.yml` → rsync на VDS → `drizzle-kit migrate` → pm2
- Тесты: Vitest (`server/**/*.test.ts`), 130+ файлов

## Команды

```bash
pnpm install --frozen-lockfile
pnpm dev                 # tsx watch, порт 3000
pnpm check               # tsc --noEmit — обязательно перед коммитом
pnpm test                # vitest run — обязательно перед коммитом
pnpm build               # vite build + esbuild сервера
cd cloudflare/tg-proxy && pnpm validate   # проверки Worker
```

Тесты, требующие внешних сервисов (Telegram `getMe`, Bitrix24), могут падать по
таймауту офлайн. Один такой красный тест при зелёном остальном suite — не блокер,
но упомяни его в описании PR.

## Git-процесс

- **Никогда не коммить и не пушь в `main`.** Каждая задача — отдельная ветка `claude/<кратко-о-задаче>`.
- Один PR = одна задача. Небольшие атомарные коммиты с сообщением на русском в формате
  `область: что сделано` (например, `masha: включён rate-limit chat`).
- Перед каждым коммитом: `pnpm check && pnpm test` зелёные (кроме внешних таймаутов).
- В описании PR: что изменено, почему, как проверить, что может сломаться.
- Не переписывай историю (`rebase -i`, `push --force`) на общих ветках.

## Правила кода

- **Без `any`.** Используй `unknown` + сужение, дженерики, типы из `drizzle/schema.ts`.
  В существующем коде ~700 `any` — не плоди новые; при правке файла убирай те, что рядом.
- **Комментарии на русском** — только к неочевидной логике. Очевидное не комментируй.
- Не ломай обратную совместимость tRPC-контрактов и SSE-протокола без явного указания.
- Не меняй `drizzle/schema.ts` без генерации миграции (`drizzle-kit generate`) и коммита
  `drizzle/NNNN_*.sql` + `drizzle/meta/*`. Никаких ручных ALTER в проде.
- Секреты: только `process.env` через `server/_core/env.ts`. Никаких литералов ключей,
  токенов, IP-адресов в коде, тестах, workflow и документации. Если нашёл — сообщи, не удаляй молча.
- Логи не должны содержать текст сообщений пользователей, промпты, профили, email, токены.
- Новые фоновые задачи не добавляй через `setInterval` в `index.ts` без обсуждения —
  все они уже живут в одном pm2-процессе и дублируются при масштабировании.

## AI-ассистенты — ключевые факты

- Worker `cloudflare/tg-proxy/src/worker.js` сейчас жёстко вызывает `@cf/meta/llama-3.1-8b-instruct-fast`
  и игнорирует поле `model`. Целевая схема: маршрутизация по `model` → Anthropic (Claude Sonnet)
  через Cloudflare AI Gateway с `stream: true`; Llama остаётся аварийным fallback.
- `server/prompts/zoyaSystemPrompt.ts` — мёртвый код (не импортируется runtime).
- `server/zoyaOrchestrator.ts`: `void messages;` — история диалога сейчас игнорируется.
- Intent Зои определяется регулярками в `zoyaContextAssembler.ts` — это временно,
  не добавляй новые регулярки под отдельные фразы.
- Золотой набор сценариев для тестов ассистентов: `HANDOVER.md`, раздел 6.6.

## Что НЕ делать без явного разрешения владельца

- Деплоить Worker (`wrangler deploy`) — только dry-run.
- Менять `deploy.yml` в части SSH/rsync/pm2.
- Удалять таблицы, колонки, файлы в `uploads`.
- Добавлять зависимости тяжелее 200 КБ в клиентский бандл.
- Отправлять что-либо во внешние сервисы (Telegram, Bitrix24) из тестов.

## Структура

```
client/src/pages, components, lib     — фронт (72k строк, есть мегафайлы 2–4k строк)
server/routers.ts + server/routers/*  — tRPC-роутеры
server/db.ts                          — 6.5k строк запросов (планируется разбиение по доменам)
server/_core/                         — express, trpc, llm, env, auth
server/zoya*.ts, server/routers/faqChat.ts, server/assistants/* — AI-слой (Маша: core + tools)
drizzle/schema.ts                     — 63 таблицы
cloudflare/tg-proxy                   — Worker (Telegram-прокси + LLM-прокси)
docs/                                 — аналитика и планы (переносится из корня)
```
