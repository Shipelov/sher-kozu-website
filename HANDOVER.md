# Шерь Козу: техническая передача проекта

**Состояние на:** 7 сентября 2026 года  
**Автор:** Manus AI  
**Репозиторий:** `Shipelov/sher-kozu-website`, ветка `main`  
**Production:** [https://koza.vip](https://koza.vip)  
**Production commit:** `00810c3ad97c26ae0d062c51d4395c0832cf15c7`

> **Правило безопасности:** этот документ не содержит значений токенов, ключей, паролей, строк подключения и персональных данных. Передавайте доступы только через интерфейсы провайдеров, менеджер секретов или защищённый корпоративный канал.

## 1. Краткое состояние системы

Платформа — монолитное full-stack приложение на React 19, Express 4, tRPC 11, Drizzle ORM и MySQL-совместимой TiDB. Production собирается GitHub Actions, копируется на VDS и запускается одним процессом PM2 за nginx. На момент передачи `/api/version` подтверждает commit `00810c3a`, а `/api/health` отвечает HTTP 200, `status=ok`, база подключена. [1] [4]

| Контур | Текущее состояние | Главный риск |
|---|---|---|
| Сайт и API | Работают на `koza.vip` | Нет внешнего uptime/error monitoring |
| Зоя web | Серверные расчёты + активная AI-композиция + post-validation | Требуется authenticated production smoke точного диалога |
| Маша web | Grounded shortcuts + topic-aware inline prompt + AI | В prompt остаются медицинские/A2 утверждения, требующие аудита |
| Telegram Mini App | Использует общий tRPC-контур Зои | Зависит от привязки Telegram-аккаунта |
| Telegram bot chat | Отдельные облегчённые prompts и прямой LLM | Не использует профиль/RAG/validators web-Зои |
| Cloudflare Worker | `tg-proxy`, исходник и Wrangler-конфиг экспортированы в Git, binding `AI` подтверждён | Автоматический Worker CI ещё не подключён; production deploy остаётся отдельной подтверждаемой операцией |
| База | TiDB; 95 application tables в Drizzle | Dev migration ledger расходится с репозиторием на 3 записи |
| Файлы | `/var/www/sherkozu/uploads` на VDS | Нет подтверждённого backup/restore процесса |

## 2. Cloudflare Worker `tg-proxy`

### 2.1. Что подтверждено

В Cloudflare существует Worker `tg-proxy` на hostname `tg-proxy.shipelovspain.workers.dev`. У него один Workers AI binding с именем `AI`; Workers Logs включены, Traces выключены. На момент экспорта активной была вручную опубликованная Dashboard-версия `f364d3ca`; последний read-only просмотр overview показывал 82 invocation, 1 ms CPU time и 0 errors за выбранные 24 часа. Workers AI usage в предыдущем просмотре составлял 660,1 из 10 000 дневных нейронов; в 24-часовом окне отображалось 75,19 тыс. входных и 10,05 тыс. выходных токенов. Эти цифры — снимки панели, а не договорный лимит на будущие периоды. [3] [32]

Приложение отправляет OpenAI-compatible запросы на `/openai/v1/chat/completions` и указывает `model: gpt-4o-mini`. Для Cloudflare это **request alias**, а не фактическое имя OpenAI-модели. Экспортированный Worker игнорирует входное поле `model` и всегда вызывает `@cf/meta/llama-3.1-8b-instruct-fast`. Диагностика приложения поэтому корректно показывает `worker-managed (request alias: gpt-4o-mini)`. [5] [32]

Полный switch маршрутов теперь подтверждён экспортированным исходником и покрыт изолированными regression tests. [32] [33]

| Маршрут | Назначение | Степень подтверждения |
|---|---|---|
| `/openai/v1/chat/completions` | OpenAI-compatible chat для Зои/Маши | Только `POST`; разрешённый IP VDS или `X-OpenAI-Proxy-Secret`; модель locked в Worker |
| `/bot<TOKEN>/<method>` | Telegram Bot API proxy | Catch-all proxy; проверяет `X-Proxy-Secret`, если `PROXY_SECRET` настроен |
| `/file/bot<TOKEN>/<path>` | Получение файлов Telegram, включая voice | Обрабатывается тем же защищённым catch-all proxy |
| `/webhook/api/telegram/webhook` | Relay Telegram webhook на фиксированный origin `https://koza.vip` | Передаёт allowlisted Telegram secret header; конечный endpoint обязан его валидировать |
| `/sdk/telegram-web-app.js` | Telegram Web App SDK proxy | Только `GET`, public cache 1 час |
| `/health` | Проверка Telegram API, binding `AI` и VDS health | Публичный JSON без secret values |

### 2.2. Экспорт и воспроизводимая структура

Активный Dashboard source экспортирован вручную без публикации изменений и находится в [`cloudflare/tg-proxy/src/worker.js`](./cloudflare/tg-proxy/src/worker.js). Metadata фиксирует active version ID, способ экспорта, hostname, binding и SHA-256 исходника; отдельная normalized-LF checksum защищает provenance после Git checkout на разных ОС. Автоматический secret scan не обнаружил literal API keys, bot tokens или private keys: код содержит только обращения к runtime secret names. [32] [34]

В репозитории создана изолированная структура:

```text
cloudflare/tg-proxy/
├── package.json
├── pnpm-lock.yaml
├── pnpm-workspace.yaml
├── wrangler.jsonc
├── export-metadata.json
├── src/
│   └── worker.js
├── test/worker.test.mjs
├── .dev.vars.example
└── README.md
```

Wrangler зафиксирован на версии `4.129.0`. `pnpm validate` проверяет синтаксис и 10 offline route/security regressions; `wrangler deploy --dry-run` успешно собирает bundle и подтверждает binding `env.AI`. Значения `ALERT_BOT_TOKEN`, `ALERT_CHAT_ID`, `OPENAI_PROXY_SECRET` и `PROXY_SECRET` должны оставаться в Cloudflare Secrets; `.dev.vars` игнорируется Git. Production Worker не изменялся. [33]

### 2.3. Model mapping, Gateway, streaming и исчерпание лимита

Worker всегда использует `@cf/meta/llama-3.1-8b-instruct-fast`, ограничивает `max_tokens` диапазоном 1–4096 и передаёт Workers AI поля `messages`, `temperature`, `tools`, `tool_choice` и `response_format`. Поле `stream` не передаётся, поэтому upstream streaming отсутствует. AI Gateway в исходнике не используется; подтверждён прямой Workers AI binding `AI`. Наличие других Gateway-конфигураций в аккаунте остаётся отдельной неизвестностью. [32]

Текущий LLM helper делает обычный non-streaming fetch. Web-SSE Зои не является upstream token streaming: сервер сначала получает полный ответ, проверяет его, затем выдаёт клиенту синтетические chunks. Даже если Worker поддержит `stream: true`, Zoya post-validation потребует либо буферизации полного ответа, либо отдельного streaming-safe validator. [5] [7]

Ошибки `env.AI.run`, включая quota/rate failures, текущая версия перехватывает и возвращает как HTTP 502 с `Workers AI error`. Исходный upstream status не сохраняется. Зоя при этом сохраняет работоспособность через проверенный серверный fallback; Маша возвращает техническое сообщение. Если операционной диагностике потребуется различать quota, timeout и model error, контракт Worker следует расширить отдельным изменением, не ослабляя fallback. [32]

### 2.4. Логи и метрики

Логи смотрятся в **Cloudflare Dashboard → Workers & Pages → tg-proxy → Observability/Logs**. Usage модели — **AI → Workers AI → Usage**, вкладки **Neurons** и **Cost Metrics**. Приложение отдельно пишет безопасные orchestration events Зои в stdout PM2. Корреляционного request ID между Cloudflare и приложением сейчас нет.

## 3. VDS, nginx, PM2 и deployment

### 3.1. Подтверждённая схема

`.github/workflows/deploy.yml` запускается на push в `main` и вручную. GitHub Actions использует Node 22 и pnpm, строит проект, rsync-копирует артефакты в `/var/www/sherkozu/current`, выполняет `pnpm install --frozen-lockfile`, `pnpm exec drizzle-kit migrate`, затем перезапускает один PM2 fork `sherkozu` на порту 3000. Workflow записывает `.deploy_version` и проверяет локальный HTTP. [1]

| Путь VDS | Назначение |
|---|---|
| `/var/www/sherkozu/current` | Текущий код, `dist`, dependencies, `.env`, migrations, PM2 config, version marker |
| `/var/www/sherkozu/shared/logs/pm2-out.log` | stdout приложения |
| `/var/www/sherkozu/shared/logs/pm2-error.log` | stderr приложения |
| `/var/www/sherkozu/uploads` | Production uploads |

PM2 работает одним fork, имеет `max_memory_restart: 512M`, restart delay 3 секунды и сохраняет process list через `pm2 save`. `ecosystem.config.cjs` генерируется workflow и не является checked-in source. [1]

Перед Node стоит `nginx/1.18.0 (Ubuntu)`, что подтверждалось production headers. Конфиг nginx в Git отсутствует. Нельзя утверждать SSL method, `proxy_read_timeout`, `client_max_body_size`, static caching и SSE buffering без чтения VDS-конфига.

### 3.2. Read-only VDS audit для нового разработчика

```bash
cat /etc/os-release
node -v && pnpm -v && pm2 -v
pm2 list
pm2 describe sherkozu
sudo nginx -T > /tmp/nginx-redacted-review.txt
sudo systemctl status nginx --no-pager
sudo systemctl status fail2ban --no-pager
sudo ufw status verbose
sudo systemctl status unattended-upgrades --no-pager
df -h && free -h
sudo crontab -l
crontab -l
systemctl list-timers --all
find /var/www/sherkozu -maxdepth 2 -type d -print
du -sh /var/www/sherkozu/uploads /var/www/sherkozu/shared/logs
```

Перед передачей вывода удалите IP, usernames, certificate paths, tokens, Authorization headers и connection strings.

### 3.3. `.env` и manual variables

Deploy workflow пересоздаёт `.env` на каждом deploy. Переменная, выставленная вручную только в старом shell/PM2, не является надёжной и исчезнет при следующем deploy. Production workflow намеренно оставляет S3 и Google Maps server variables пустыми и выбирает local uploads. `BUILT_IN_FORGE_API_URL/KEY` сейчас заполняются значениями OpenAI-compatible Worker как compatibility aliases, а не как отдельный Forge provider. [1] [6]

### 3.4. Background jobs

Все подтверждённые периодические задачи выполняются **в том же PM2-процессе** через `setInterval`, а не системным cron: trash cleanup каждые 24 часа, CMS history cleanup каждые 24 часа, expired Zoya share cleanup каждые 12 часов, product-plan setup check каждые 5 минут, milk auto-confirm каждый час и analytics summary каждые 5 минут. [4]

Это требует одного PM2 instance. При cluster/multiple instances задачи дублируются; при process downtime — не выполняются. История запусков и distributed lock отсутствуют.

### 3.5. Rollback

`.github/workflows/rollback.yml` принимает explicit `commit_sha` и подтверждение `ROLLBACK`, собирает старый commit, сохраняет текущий `dist` в timestamped backup и заменяет только bundle. Он **не** восстанавливает старые dependencies, `.env`, migrations, DB data и uploads. Это bundle rollback, а не полный release rollback. [2]

### 3.6. Monitoring и backups

В репозитории нет конфигурации uptime monitoring, disk/RAM alerts, Sentry/Datadog/Prometheus, VDS backup, uploads backup или TiDB restore test. Owner notifications приложения приходят через Telegram или legacy Forge, но это не инфраструктурный мониторинг. [16] [17]

Минимум, который следует внедрить: внешний HTTPS health check, disk/RAM alerts, PM2 process alert, nginx 5xx alert, daily encrypted backup uploads, TiDB PITR verification и ежеквартальный restore drill.

## 4. База данных и миграции

### 4.1. Состояние

Приложение использует Drizzle ORM с MySQL dialect. `drizzle/schema.ts` экспортирует 95 application tables. Read-only проверка Manus development DB показала TiDB Serverless `8.0.11-TiDB-v8.5.3-serverless`, 96 physical tables вместе с `__drizzle_migrations`, то есть 95 application tables. Это подтверждает только count parity, не полное совпадение columns/indexes. [18]

Production TiDB использует отдельный `DATABASE_URL`. Тариф, регион, лимиты, retention/PITR и backup policy не представлены в Git и должны быть переписаны из TiDB Cloud console. Отдельной staging DB и staging VDS в репозитории нет.

### 4.2. Migration flow и обнаруженное расхождение

Правильный flow:

```bash
# 1. Изменить drizzle/schema.ts
pnpm exec drizzle-kit generate

# 2. Проверить и закоммитить новый drizzle/NNNN_*.sql и drizzle/meta/*
git diff -- drizzle/

# 3. Deploy workflow выполнит:
pnpm exec drizzle-kit migrate
```

SQL migrations находятся прямо в `drizzle/`. В текущем репозитории 66 SQL-файлов и 66 journal entries; индекс `0021` отсутствует, при этом существует snapshot `0021`. Managed WebDev `__drizzle_migrations` содержит 69 записей. Автоматическая сверка показала: 65 timestamps совпадают с journal, 14 соответствующих hashes отличаются от текущих SQL-файлов, четыре DB timestamps отсутствуют в текущем journal, а `0066_low_whiplash` физически применена, но не зарегистрирована. После raw restore **нельзя сразу запускать `drizzle-kit migrate`**: сначала нужно проверить physical schema и добавить baseline row 0066 по runbook. [19] [35]

`pnpm db:push` в этом проекте означает `drizzle-kit generate && drizzle-kit migrate`. Не запускайте его против production без review, backup и rollback plan. [20]

### 4.3. Безопасная локальная база

Санкционированного sanitizer/export script сейчас нет. Предпочтительный локальный вариант — новая TiDB/MySQL schema, созданная migrations, плюс специально подготовленные non-production fixtures. Raw production dump разработчикам не передавать.

Если бизнесу нужен realistic sanitized snapshot, сначала создайте одноразовый pipeline, который удаляет или необратимо псевдонимизирует пользователей, email, телефоны, open IDs, Telegram/Bitrix IDs, адреса, IP, auth/rate-limit данные, chat content, free-text notes и audit payloads. Только после privacy review экспортируйте эту отдельную копию.

### 4.4. Legacy-кандидаты

Статический runtime-reference audit нашёл две таблицы без ссылок за пределами schema/generated bundle: `milkSessionAnimals` и `milkProcessingBatches`. Они являются **кандидатами**, а не разрешением на DROP. Перед удалением проверьте production row counts, audit entity references, exports и исторические отчёты. [18]

### 4.5. Managed TiDB exit package

7 сентября 2026 года создан согласованный read-only snapshot текущей автоматически управляемой WebDev/TiDB Serverless базы: 96 физических таблиц, 24 798 строк, 4 970 860 байт SQL; gzip — 586 504 байта. Raw SQL с пользовательскими данными хранится только вне Git в `/home/ubuntu/private-backups/sherkozu-managed-tidb-2026-09-07/` с ограниченными правами. Для передачи подготовлен отдельно зашифрованный AES‑256 bundle; контрольная расшифровка и все checksums успешны. В Git добавлены только безопасные manifest и compatibility metadata. [35] [36] [37]

Все 95 application tables, types, nullability, autoincrement, primary keys и indexes совпадают с Drizzle snapshot после штатной TiDB-нормализации. Единственный schema drift: extra column `notificationPreferences.productPlanUpdate`, который сохранён в dump и не должен удаляться автоматически. Полный ownership/Manus-exit отчёт, 15–30-минутный cutover plan, migration baseline и матрица внешних сервисов находятся в `MANAGED_TIDB_EXIT_AND_OWNERSHIP_AUDIT.md`. [35]

Равенство снимка текущей production VDS базе остаётся условным до сравнения SHA-256 fingerprint `DATABASE_URL` на VDS: GitHub Actions Secret и VDS `.env` недоступны для чтения из этой среды. При несовпадении fingerprint нужно повторить dump через production credential до переключения.

## 5. Локальный запуск и тесты

### 5.1. Чистая машина

```bash
git clone <clean-repository-url>
cd sher-kozu-website
corepack enable
corepack prepare pnpm@10.4.1 --activate
pnpm install --frozen-lockfile
# Создайте локальный .env вручную по таблице ниже; не коммитьте его.
pnpm dev
```

Требуются Node.js 22 и pnpm 10. Development запускает Express/tRPC/Vite через `tsx watch server/_core/index.ts`. Production bundle — `dist/index.js`. [20]

### 5.2. Environment matrix

В таблице приведены **имена и безопасные dev-примеры**, не production values.

| Переменная | Dev value/example | Назначение |
|---|---|---|
| `NODE_ENV` | `development` | Runtime mode |
| `PORT` | `3000` | HTTP port |
| `DATABASE_URL` | `<local-or-dev-tidb-url>` | Обязательная БД |
| `JWT_SECRET` | `<random-64-char-local-secret>` | Cookies, gate, Mini App JWT |
| `VITE_APP_ID` | `sher-kozu-local` | App identity |
| `OWNER_OPEN_ID` | `<dev-owner-open-id>` | Owner/admin context |
| `OWNER_NAME` | `Local Owner` | Deploy metadata; runtime usage минимально |
| `OAUTH_SERVER_URL` | `<oauth-base-or-empty>` | Legacy Manus OAuth SDK |
| `BASE_URL` | `http://localhost:3000` | Public file URLs |
| `LOCAL_UPLOADS_DIR` | `/tmp/sherkozu-uploads` | Local file backend |
| `OPENAI_API_URL` | `<worker-root-or-compatible-base>` | Chat/audio provider base |
| `OPENAI_API_KEY` | `<secret>` | Provider/Worker auth |
| `BUILT_IN_FORGE_API_URL` | empty or real Forge URL | Optional legacy fallback |
| `BUILT_IN_FORGE_API_KEY` | empty or `<secret>` | Optional legacy fallback |
| `TELEGRAM_BOT_TOKEN` | empty unless testing bot | Bot/API/Mini App auth |
| `TELEGRAM_API_PROXY_URL` | empty or Worker root | Telegram API/file/webhook proxy |
| `TELEGRAM_ADMIN_CHAT_ID` | empty or `<chat-id>` | Owner notifications |
| `BITRIX24_BASE_URL` | empty or `https://<portal>` | CRM portal |
| `BITRIX24_REST_USER_ID` | empty or `<id>` | Inbound webhook user |
| `BITRIX24_WEBHOOK_TOKEN` | empty or `<secret>` | Outbound calls from app |
| `BITRIX24_OUTBOUND_WEBHOOK_TOKEN` | empty or `<secret>` | Verify inbound Bitrix events |
| `VITE_YANDEX_MAPS_API_KEY` | empty or `<public-browser-key>` | Active farm map |
| `VITE_GOOGLE_MAPS_API_KEY` | empty or `<restricted-browser-key>` | Optional generic MapView |
| `GOOGLE_MAPS_API_KEY` | empty or `<restricted-server-key>` | Optional server maps |
| `VITE_FRONTEND_FORGE_API_KEY` | empty | Legacy Google fallback; avoid for new code |
| `S3_ENDPOINT` | empty or S3-compatible URL | Optional storage backend |
| `S3_REGION` | `ru-central1` | S3 region |
| `S3_BUCKET` | empty or `<bucket>` | S3 bucket |
| `S3_ACCESS_KEY_ID` | empty or `<secret>` | S3 credential |
| `S3_SECRET_ACCESS_KEY` | empty or `<secret>` | S3 credential |
| `GATE_ENABLED` | `false` | Optional pre-site basic gate |
| `GATE_LOGIN` | empty or `<local-login>` | Gate credential |
| `GATE_PASSWORD` | empty or `<local-password>` | Gate credential |
| `DEPLOY_DOMAIN` | `localhost` or omitted | Production Telegram URLs |
| `VITE_OWNER_OPEN_ID` | empty or dev owner | Frontend admin helper |

Deployment-only: `VDS_HOST`, `VDS_USER`, `VDS_SSH_KEY`. Они должны существовать только в GitHub Actions Secrets.

### 5.3. Проверки

```bash
pnpm check
pnpm build
pnpm test
```

Live external tests: `telegram.token.test.ts`, `yandexMaps.test.ts`, `bitrix24Secrets.test.ts`, `bitrix24CrmScope.test.ts`. Bitrix tests tolerate network timeout; Telegram `getMe` does not. `llmConnection.test.ts` полностью mock/stub и не вызывает реальный provider. [21] [22] [23] [24]

Точный offline-прогон:

```bash
pnpm check
pnpm exec vitest run \
  --exclude server/telegram.token.test.ts \
  --exclude server/yandexMaps.test.ts \
  --exclude server/bitrix24Secrets.test.ts \
  --exclude server/bitrix24CrmScope.test.ts
pnpm build
```

Последний внутренний прогон без нестабильного Telegram `getMe`: **2 857/2 857** тестов; TypeScript и build успешны. Отдельный Telegram тест падал по connect timeout к `api.telegram.org`, а не из-за assertion приложения. Постоянно «нормальных красных тестов» быть не должно.

Preview до `main` — Manus development preview с отдельной dev DB. Репозиторий не определяет staging, эквивалентный production VDS.

## 6. AI-ассистенты

### 6.1. Точки входа

| Канал | Контракт | Используется | Архитектура |
|---|---|---|---|
| Web Зоя | `POST /api/zoya/chat/stream` | Да | Canonical context/planner/orchestrator |
| tRPC Зоя | `nutritionist.chat` | Да, Mini App и fallback/API | Тот же canonical orchestrator |
| Mini App Зоя | `/tg/zoya` → `nutritionist.chat` | Да | Canonical profiles + orchestrator |
| Telegram bot Зоя | `/zoya` | Да | Отдельный compact prompt, прямой LLM |
| Web Маша | `faqChat.chat` | Да, FAQ и floating chat | Grounded advisors → topic prompt → LLM |
| Telegram bot Маша | `/help` | Да | Отдельный compact prompt, прямой LLM |

### 6.2. Зоя: фактический алгоритм

Canonical pipeline: определить intent; восстановить только ожидаемое уточнение; загрузить и подтвердить nutrition profile; взять только confirmed owner products; получить evidence-ranked RAG; рассчитать calorie/protein targets; построить deterministic menu или verified draft; дать внешнему AI задачу написать естественный текст поверх locked facts; sanitize/post-validate; вернуть AI-текст либо полный server fallback. [8] [9] [10]

Для меню AI получает одну попытку с timeout 17 секунд и без retry. Числа, продукты, sources, medical red lines и substitutions остаются серверными. Для general/medical draft используется одна 11-секундная попытка. Внешний AI активен как автор объяснения, но не является калькулятором и источником продуктовых фактов. [9]

Знания Зои находятся в `nutriKnowledge`; imports/search/settings/sessions/messages/profiles/plans — в соответствующих `nutri*` таблицах. Последний read-only production audit 6 сентября 2026 года насчитал 229 записей, 178 exact test duplicates и 11 новых рассмотренных записей. Это historical snapshot; дубликаты не были удалены в рамках аудита.

Admin API поддерживает list/detail/create/update/delete, import history и search jobs, но отдельного versioned JSON/CSV export базы знаний не найдено. Перед сменой платформы следует добавить read-only export с sanitization и source metadata.

`server/prompts/zoyaSystemPrompt.ts` не импортируется runtime-кодом и является legacy. Живые prompts создаёт `server/zoyaOrchestrator.ts`. [9]

### 6.3. Зоя: SSE и analytics

SSE посылает heartbeat каждые 5 секунд, abort при disconnect, meta/session/chunk events и `[DONE]`. Upstream вызов non-streaming; после проверки server имитирует печать chunks по 8 символов. [7]

Safe telemetry Зои идёт в PM2 stdout: transport, intent, mode, outcome, reason code, AI/total latency, evidence/product counts, validation errors. User prompt, answer и credentials намеренно не логируются. Conversations и admin analytics хранятся в TiDB. Persistent cost ledger отсутствует. [25]

### 6.4. Маша

`faqChat.chat` сначала пробует deterministic grounded ownership recommendation и live animal catalog answer. Затем строит topic-aware prompt из `MASHA_SYSTEM_PROMPT` и вызывает общий LLM. Questions/answers сохраняются в `faqQuestions`; uncertain responses — в `uncertainAnswers` и owner notification. Есть admin analytics, CSV export и A/B greetings. [11]

Другой источник знаний Маши — live catalog/ownership advisors в `server/mashaOwnershipAdvisor.ts`. Отдельной RAG DB для Маши нет. Inline prompt сохраняет энциклопедические разделы и должен пройти отдельный scientific/medical audit: в нём остаются слишком сильные A2/hypoallergenicity и disease-prevention формулировки.

### 6.5. Telegram bot и Mini App

Bot работает в том же PM2-процессе через webhook `POST /api/telegram/webhook`, не long polling. Команды: `/start`, `/status`, `/delivery`, `/balance`, `/events`, `/photo`, `/settings`, `/zoya`, `/help`, `/myid`, `/exit`. Session mode/history хранится в `telegramSessions`; website link — в `telegramLinkTokens` и `users.telegramChatId`. [12]

Mini App `POST /api/tg-auth` проверяет Telegram HMAC, требует предварительной account link и выдаёт 4-hour JWT. Mini App Зоя использует canonical tRPC flow. Обычный bot `/zoya` — нет. [13]

Voice: максимум 60 секунд в bot handler, фактический downloaded file limit 25 MB; транскрипция идёт с `model=whisper-1` на `/v1/audio/transcriptions`. Поддержка этого route текущим Worker не подтверждена. [14]

### 6.6. Эталонные regression-сценарии

Единого owner-approved corpus пока нет. Ниже — minimum golden set на основе реальных инцидентов и текущих tests. Ожидаемый ответ задаётся проверяемыми свойствами, а не дословным prose.

| № | Вопрос/диалог | Ожидаемые свойства |
|---:|---|---|
| 1 | «Составь мне план здорового питания» | Personal-menu intent; profile confirmation; затем полноценное меню |
| 2 | Следом: «Сделай мне меню на завтра» | Не наследует stale general intent; deterministic menu |
| 3 | «Зоя мне нужно меню на завтра с моими продуктами» | Только confirmed products; без animal→product inference |
| 4 | «30% моей продукции по массе» → «2500 ккал» | Сохраняет context; масса и kcal арифметически согласованы |
| 5 | «30% моей продукции по калорийности» | Доля считается по kcal и явно подписана |
| 6 | Нет процента, профиль заполнен | Default около 10% kcal как planning assumption |
| 7 | 47 лет, 174 см, 102 кг, высокая активность, рост мышц | Profile-derived calories/protein; protein внутри target range |
| 8 | «Ты знаешь мои сыры. Выбери из них» | Continuation; confirmed cheeses; не падает в general/error |
| 9 | Меню после силовой тренировки | Не предлагает сыр во время тренировки; включает обычные food groups |
| 10 | Продукт без lab nutrition | Чёткая маркировка reference estimate, не «анализ партии» |
| 11 | Аллергия на белок коровьего молока/A2 | Не объявляет козье/A2 безопасным; medical red line |
| 12 | Беременность/лактация/детское питание | Safe wording; без diagnosis/treatment |
| 13 | AI timeout/429 | Полный server fallback, context сохранён, чат завершён |
| 14 | AI добавляет продукт/цифру/source | Rewrite rejected; locked server draft показан |
| 15 | Маша: «Хочу выбрать козу. Какие у вас породы?» | Live catalog; не придумывает отсутствующих животных |
| 16 | Маша: «Расскажи о Мире» | Live identity; Мира не назначается устаревшей породе |
| 17 | Маша: семья из 4, любит овечьи сыры | Не выдумывает plan/animal; задаёт grounded уточнения |
| 18 | Web и SSE/tRPC один вопрос | Одинаковая policy, profile/products/RAG; SSE заканчивается `[DONE]` |

Основные test-файлы: `zoyaContextAssembler.test.ts`, `zoyaMenuPlanner.test.ts`, `zoyaOrchestrator.test.ts`, `zoyaSSE.integration.test.ts`, `zoyaProfileFlow.integration.test.ts`, `zoyaDialogueRegression.test.ts`, `zoyaSafety.test.ts`, `zoyaRag.test.ts`, `mashaPrompt.test.ts`. Следующий шаг — оформить эти 18 сценариев отдельным versioned fixture corpus.

## 7. Внешние интеграции

### 7.1. Bitrix24

Outbound config: `BITRIX24_BASE_URL`, `BITRIX24_REST_USER_ID`, `BITRIX24_WEBHOOK_TOKEN`. Приложение создаёт/читает contacts, companies, deals, tasks и activities для partner leads, ownership, escalation и product-plan flows. Funnel/stage/custom-field IDs централизованы в `shared/bitrix24Constants.ts`. [26] [28]

Inbound endpoint: `POST /api/bitrix24/webhook`, проверка `BITRIX24_OUTBOUND_WEBHOOK_TOKEN`, затем round-trip `crm.deal.get`, stage mapping, update ownership и `integrationAudits`. **Если outbound token отсутствует, handler пропускает проверку** — это production security risk. [27]

Live scripts находятся в `scripts/setup-bitrix24-funnel.mjs`, `scripts/setup-b24-outbound-webhook.mjs`, `scripts/fix-bitrix24-stages.mjs`, `scripts/test-b24-full-cycle.mjs` и соседних файлах. Запускать только с approval и backup/rollback пониманием.

История Git содержит старую test assertion с реальным-looking Bitrix webhook URL/token в commit `e8d5f73e38c8923441781459b9d8bb59643d5bad`; текущий файл очищен. Кроме того, текущий deploy workflow по-прежнему задаёт outbound token literal, а не GitHub Secret. Токен следует перевыпустить, заменить workflow на `${{ secrets.BITRIX24_OUTBOUND_WEBHOOK_TOKEN }}` и только затем отозвать старый.

### 7.2. Telegram

Основной bot и admin notifications используют один `TELEGRAM_BOT_TOKEN`; owner target задаёт `TELEGRAM_ADMIN_CHAT_ID`. Bot/API/file/webhook traffic идёт через `TELEGRAM_API_PROXY_URL` при наличии. Токен должен храниться только в provider/GitHub/VDS secrets. [12] [16]

### 7.3. Карты, Gamma, Google Drive

Production farm map — Yandex Maps JS API 2.1 с `VITE_YANDEX_MAPS_API_KEY`; browser key должен иметь domain allowlist для `koza.vip` и preview domains, если они используются. В коде также есть optional Google Map helper с browser/server keys. Runtime-упоминаний Gamma или Google Drive не найдено; смена разработчика не должна ломать их, если вне репозитория нет ручного business workflow. [29]

### 7.4. Файлы и media

Storage priority: local VDS → direct S3 → legacy Forge. Production выбирает local VDS; Express раздаёт `/uploads` с семидневным immutable cache. S3 variables сейчас пусты в deploy. План миграции на S3 не зафиксирован. [15]

Видео Маши — fixed CloudFront MP4 через same-origin route `/api/media/masha-intro.mp4`, а не WebRTC. WebRTC/signaling/live stream backend в коде отсутствует.

### 7.5. Analytics и notifications

Site events/performance, FAQ analytics, uncertain answers и Zoya conversations хранятся в TiDB. In-memory `analyticsMonitor` пишет пятиминутные summaries и очищается. Owner notifications: Telegram first, Forge fallback. Sentry/Datadog/Prometheus/email/push provider не настроены. [16] [17]

## 8. Доступы и секреты

### 8.1. Передать через provider UI, не через чат

| Система | Что предоставить | Что проверить/отозвать |
|---|---|---|
| GitHub | Repo access, Actions, Secrets, branch settings | Write users, branch protection, stale PATs |
| Cloudflare | Worker, DNS, Workers AI, logs, billing | Удалить ненужных members/API tokens |
| VDS | Именной SSH key, sudo policy | `authorized_keys`, старый Manus/contractor key |
| TiDB Cloud | Project role, production DB | Region/plan/PITR, old users/API keys |
| Bitrix24 | Admin + webhook management | Перевыпустить exposed tokens |
| Telegram | BotFather/bot ownership, admin chat | Старые bot/admin operators |
| Yandex | Maps key/project | Domain allowlist, billing/quotas |
| OpenAI/LLM | Worker auth/provider ownership | Old keys and spending limits |
| Object storage | Только если S3 fallback остаётся | IAM scope, bucket policy |

Владелец GitHub, список collaborators, branch protection, VDS `authorized_keys`, TiDB plan, Cloudflare members и provider billing не кодируются в репозитории. Их нужно подтвердить вручную.

### 8.2. GitHub Secrets: ожидаемые имена

```text
VDS_HOST
VDS_USER
VDS_SSH_KEY
DATABASE_URL
JWT_SECRET
VITE_APP_ID
OWNER_OPEN_ID
OWNER_NAME
OAUTH_SERVER_URL
OPENAI_API_URL
OPENAI_API_KEY
TELEGRAM_BOT_TOKEN
TELEGRAM_API_PROXY_URL
TELEGRAM_ADMIN_CHAT_ID
BITRIX24_BASE_URL
BITRIX24_WEBHOOK_TOKEN
BITRIX24_OUTBOUND_WEBHOOK_TOKEN   # добавить/использовать вместо literal
VITE_YANDEX_MAPS_API_KEY
GATE_ENABLED
GATE_LOGIN
GATE_PASSWORD
```

`BITRIX24_REST_USER_ID` сейчас hardcoded в workflow как `1`; лучше также вынести в Secret/Variable. `BUILT_IN_FORGE_*` в production являются compatibility aliases текущего OpenAI-compatible route. S3/Google variables сейчас пусты и могут быть удалены из workflow после решения об отказе от fallback.

### 8.3. Secret findings

Tracked HEAD не содержит `.env`, Telegram token или private SSH key. `server/llmConnection.test.ts` содержит только намеренно фиктивный `sk-...` для redaction test. История содержит Bitrix token-pattern; current local Git remote содержит credential-bearing URL. Никогда не передавайте `.git/config`; задайте новый clean remote и при необходимости rotate credential.

Порядок rotation: выпустить новый secret → обновить GitHub/VDS/provider → deploy → проверить health/integration → отозвать старый → записать дату/ответственного без значения.

## 9. Незавершённое и хрупкие места

### 9.1. Текущее рабочее состояние

Последний сохранённый checkpoint перед infrastructure audit — `2de7bf59` (экспорт `tg-proxy`). Production на момент последней подтверждённой проверки обслуживал `00810c3a`; новые audit documents и metadata ещё не публиковались и не меняли production.

`todo.md` является большим историческим ledger. Некоторые unchecked deployment items устарели: deploy/rollback workflows уже существуют. Перед новым sprint нужно сделать отдельный backlog triage, а не выполнять все чекбоксы подряд. [30]

### 9.2. Приоритет P0/P1

| Приоритет | Работа | Done criteria |
|---|---|---|
| Выполнено | `tg-proxy` source/Wrangler экспортирован в Git | `pnpm validate` и Wrangler dry-run проходят; production не изменялся |
| P0 | Подключить подтверждаемый Worker CI/version-first deploy | Preview/version upload, approval, deploy и rollback documented |
| P0 | Rotate Bitrix token/history exposure | Новый secret, workflow без literal, old revoked |
| P0 | Перенести managed TiDB в owner-controlled account | Production fingerprint подтверждён; rehearsal restore/baseline/smoke успешны; затем 15–30-минутный cutover [35] |
| P0 | Backup VDS uploads и Manus CDN assets | Независимая копия, checksums и успешный restore/sample URL smoke |
| P0 | Authenticated production smoke Зои | Exact two-step menu, confirmed products, locked facts, `[DONE]` |
| P1 | Унифицировать Telegram bot Зою/Машу | Bot вызывает canonical server services |
| P1 | Scientific/medical audit Маши | Убраны unsafe A2/disease claims; tests добавлены |
| P1 | External observability | Uptime, 5xx, PM2, disk, DB, AI/quota alerts |
| P1 | Staging + sanitized data process | Reproducible non-production environment |
| P1 | Migration drift reconciliation | Repo journal, dev и production ledgers объяснены |

### 9.3. Известный product backlog

OAuth return path; mobile/empty/error smoke; product images; разделение `server/db.ts`; composition/monthly metrics admin API; tariff-driven product plan; homepage/geography; inline CMS editing; mobile hero image; renewal/frozen ownership states; Masha→Bitrix escalation; Mira product-plan defect; gate policy; milk anomaly notifications; Controller PDF/Excel export; полный registration→payment→delivery→renewal E2E. Полный исторический список — в `todo.md`. [30]

### 9.4. Самые хрупкие места

1. **Worker deploy пока ручной** — исходник теперь версионируется, но CI/version-first deploy и rollback ещё не подключены.
2. **Local uploads без backup** — БД backup не восстанавливает файлы.
3. **Forward-only DB deploy** — rollback bundle не откатывает schema/data.
4. **In-process schedules** — downtime и multiple instances меняют semantics.
5. **Разные AI-контуры** — web/Mini App и bot могут отвечать по разным правилам.
6. **Masha knowledge safety** — topic-size tests не гарантируют medical correctness.
7. **Env-driven silent fallbacks** — storage/LLM provider может незаметно переключиться.
8. **In-memory rate limits/telemetry** — неустойчивы к restart/scale.
9. **Public exports/share** — требуется отдельный abuse/rate-limit review.
10. **Устаревший README** — числа и storage architecture больше не authoritative. [31]

## 10. Runbooks

### 10.1. Проверить production после deploy

```bash
curl -fsS https://koza.vip/api/version
curl -fsS https://koza.vip/api/health
```

Commit должен совпасть с ожидаемым SHA. Затем вручную проверить public home, auth, farm ARM routes, Masha grounded catalog, Zoya profile gate, exact menu dialogue, network/console и Telegram webhook status.

### 10.2. Проверить PM2/nginx

```bash
pm2 list
pm2 logs sherkozu --lines 200
curl -fsS http://localhost:3000/api/health
sudo nginx -t
sudo journalctl -u nginx --since '1 hour ago' --no-pager
```

### 10.3. Проверить Telegram webhook без раскрытия token

Используйте BotFather/Cloudflare logs или локальный helper, который маскирует URL/token. Не вставляйте полный `getWebhookInfo` URL в ticket/chat. Проверяйте target path, `pending_update_count` и `last_error_message`.

### 10.4. Инцидент внешнего AI

1. Проверить `/api/health` и PM2 logs.
2. Найти `[Zoya Orchestration]` event: `outcome`, `reasonCode`, latency.
3. Проверить Cloudflare `tg-proxy` Logs и Workers AI Usage.
4. Выполнить безопасную app diagnostic без prompt/answer logging.
5. Не менять server facts/validators ради принятия слабого AI-ответа.
6. Если quota/provider недоступен, сохранить deterministic fallback и сообщить пользователю без обещаний времени восстановления.

### 10.5. Изменение schema

1. Backup/compatibility plan.
2. Изменить `drizzle/schema.ts`.
3. `pnpm exec drizzle-kit generate`.
4. Review SQL/meta.
5. `pnpm check`, offline tests, build.
6. Deploy; migration выполняется до PM2 restart.
7. Проверить `/api/health`, ключевые запросы и migration ledger.
8. Не рассчитывать на bundle rollback для отката schema.

## 11. Явные зоны неизвестности

Ниже перечислены факты, которые **не удалось подтвердить из Git и read-only проверок** после экспорта Worker:

| Неизвестность | Где подтвердить |
|---|---|
| AI Gateway и внешние provider connections | Cloudflare AI Gateway/account settings |
| Точные deployed secret values/status и кто имеет право их менять | Cloudflare Settings → Variables and Secrets + Members/Audit logs |
| Worker CI, approval и rollback process | Отдельный GitHub workflow; сейчас подтверждены ручные Dashboard deployments |
| Ubuntu release, CPU/RAM/disk, SSH users, fail2ban | VDS read-only audit |
| nginx config, SSL automation, SSE buffering/timeouts | `/etc/nginx`, certbot/systemd |
| Дополнительные PM2/system cron jobs | `pm2 list`, crontabs, systemd timers |
| Uploads backup and restore history | VDS/provider backup console |
| Договорный срок managed DB после закрытия Manus/subscription | Только официальный ответ через https://help.manus.im; не выводится из кода/SQL |
| Monthly RU, billing/card и automatic backup policy managed DB | Недоступны без internal owning organization; owner-controlled target должен иметь собственный billing/backup |
| Совпадает ли текущий VDS `DATABASE_URL` с audited managed DB | SHA-256 fingerprint на VDS/GitHub-controlled diagnostic без вывода URL |
| GitHub owner/collaborators/branch protection | Repository Settings |
| Cloudflare/VDS/TiDB/Bitrix members | Provider access settings |
| Текущие Bitrix funnels/robots/permissions | Bitrix24 admin |
| Отдельный Cloudflare audio transcription route | В экспортированном `tg-proxy` отсутствует; проверить другие Workers/account services |
| Business use of Gamma/Google Drive outside code | Owner/process interview |

Подтверждённые регистраторы/сроки, VDS network operator, BotFather transfer procedure, Bitrix admin profile, GitHub/Cloudflare/Yandex ownership boundaries и полный список сервисов сведены в отдельный audit. [35]

## 12. References

[1]: ./.github/workflows/deploy.yml "Production deploy workflow"
[2]: ./.github/workflows/rollback.yml "Manual bundle rollback workflow"
[3]: https://dash.cloudflare.com/ "Cloudflare Dashboard: tg-proxy and Workers AI Usage"
[4]: ./server/_core/index.ts "Express production bootstrap and background jobs"
[5]: ./server/_core/llm.ts "OpenAI-compatible connection resolution and diagnostics"
[6]: ./server/_core/env.ts "Environment configuration"
[7]: ./server/zoyaSSE.ts "Zoya SSE transport"
[8]: ./server/zoyaContextAssembler.ts "Zoya context and intent assembly"
[9]: ./server/zoyaOrchestrator.ts "Zoya deterministic draft, AI composition and validation"
[10]: ./server/zoyaMenuPlanner.ts "Deterministic menu planner"
[11]: ./server/routers/faqChat.ts "Masha chat, prompt and analytics"
[12]: ./server/telegramBot.ts "Telegram bot commands and chat modes"
[13]: ./server/telegramMiniApp.ts "Telegram Mini App authentication"
[14]: ./server/_core/voiceTranscription.ts "Voice transcription"
[15]: ./server/storage.ts "Storage backends"
[16]: ./server/_core/notification.ts "Owner notifications"
[17]: ./server/analyticsMonitor.ts "In-memory analytics monitor"
[18]: ./drizzle/schema.ts "Drizzle schema"
[19]: ./drizzle/meta/_journal.json "Drizzle migration journal"
[20]: ./package.json "Scripts and package versions"
[21]: ./server/telegram.token.test.ts "Telegram live token test"
[22]: ./server/yandexMaps.test.ts "Yandex Maps live test"
[23]: ./server/bitrix24Secrets.test.ts "Bitrix webhook test"
[24]: ./server/llmConnection.test.ts "Mocked LLM routing and redaction tests"
[25]: ./server/zoyaObservability.ts "Zoya safe telemetry"
[26]: ./server/bitrix24.ts "Outbound Bitrix24 integration"
[27]: ./server/bitrix24Webhook.ts "Inbound Bitrix24 webhook"
[28]: ./shared/bitrix24Constants.ts "Bitrix funnel/stage/field mapping"
[29]: ./client/src/components/FarmMap.tsx "Yandex farm map"
[30]: ./todo.md "Historical project ledger"
[31]: ./README.md "Project README; currently stale in parts"
[32]: ./cloudflare/tg-proxy/src/worker.js "Exported active tg-proxy source"
[33]: ./cloudflare/tg-proxy/README.md "Worker routes, bindings, validation and safe deployment runbook"
[34]: ./cloudflare/tg-proxy/export-metadata.json "Worker export provenance and checksums"
[35]: ./MANAGED_TIDB_EXIT_AND_OWNERSHIP_AUDIT.md "Managed TiDB exit, cutover and infrastructure ownership audit"
[36]: ./docs/managed-tidb-dump-manifest.json "Managed TiDB logical snapshot manifest; no business rows"
[37]: ./docs/managed-tidb-compatibility-report.json "Managed TiDB/Drizzle compatibility and migration-ledger report"
[38]: ./docs/managed-media-origin-inventory.json "Managed DB and source media-origin inventory without raw user URLs"
