# Cloudflare Worker `tg-proxy`

Worker — сетевой шлюз приложения для Telegram и LLM. Исходник в [`src/worker.js`](./src/worker.js) был экспортирован из Dashboard 7 сентября 2026 (версия `f364d3ca`, см. [`export-metadata.json`](./export-metadata.json)) и с 9 сентября 2026 развивается в репозитории: маршрут `/openai/*` ходит к Anthropic Claude через Cloudflare AI Gateway с поддержкой `stream: true` и tools, Workers AI Llama остался аварийным fallback, добавлена транскрипция голоса. **Production Worker из репозитория не деплоится автоматически** — только `wrangler deploy --dry-run`; публикация описана ниже.

## Маршруты

| Маршрут | Назначение | Защита |
|---|---|---|
| `GET /health` | Проверка Telegram API, binding `AI`, конфигурации Anthropic и VDS | Публичный JSON без секретов |
| `POST /openai/v1/chat/completions` | OpenAI Chat Completions → Anthropic Messages (AI Gateway) или Workers AI | `OPENAI_PROXY_SECRET` в `Authorization: Bearer …` или `X-OpenAI-Proxy-Secret` |
| `POST /openai/v1/audio/transcriptions` | multipart `file` → Workers AI `@cf/openai/whisper` → `{ text }` | тот же секрет |
| `/sdk/*` | Proxy Telegram Web App SDK | публичный read-only |
| `/webhook/*` | Relay webhook на `https://koza.vip` | только allowlisted headers |
| остальные пути | Telegram Bot API/file proxy | `X-Proxy-Secret`, если `PROXY_SECRET` задан |

Авторизация `/openai/*` — только по секрету, сравнение за постоянное время (`crypto.subtle.timingSafeEqual`, в тестах — XOR по байтам). Список IP-адресов из кода удалён.

## Маршрутизация моделей

Поле `model` запроса — alias, не имя модели:

| `model` в запросе | Провайдер | Фактическая модель |
|---|---|---|
| `claude-sonnet` (и любое неизвестное значение, в том числе старый `gpt-4o-mini`) | Anthropic через AI Gateway | secret `ANTHROPIC_MODEL_SONNET` (по умолчанию `claude-sonnet-5`) |
| `claude-haiku` | Anthropic через AI Gateway | secret `ANTHROPIC_MODEL_HAIKU` (по умолчанию `claude-haiku-4-5`) |
| `workers-ai` | Workers AI | `@cf/meta/llama-3.1-8b-instruct-fast` |

Идентификаторы моделей — по [Models overview](https://platform.claude.com/docs/en/models/overview) на 9 сентября 2026: `claude-sonnet-5` (Claude Sonnet 5), `claude-haiku-4-5` (alias `claude-haiku-4-5-20251001`). Заголовок `anthropic-version: 2023-06-01`.

Ответ всегда несёт `X-Koza-Provider` (`anthropic` | `workers-ai`), `X-Koza-Model` (фактическая модель) и `X-Koza-Requested-Model` (alias). Если Anthropic-секреты не заданы, alias `claude-*` обслуживает Workers AI с `X-Koza-Fallback: workers-ai` и `X-Koza-Fallback-Reason: anthropic-unconfigured`.

### Конвертация OpenAI → Anthropic

- `system`/`developer`-сообщения объединяются в поле `system`; `user`/`assistant` → `messages` (соседние сообщения одной роли склеиваются, история всегда начинается с `user`).
- `assistant.tool_calls` → блоки `tool_use`; сообщения `role: tool` → блоки `tool_result` внутри `user`.
- `tools[].function` → `tools[]` Anthropic (`name`, `description`, `input_schema`); `tool_choice`: `auto` → `{type:"auto"}`, `required` → `{type:"any"}`, `{name}`/`{function:{name}}` → `{type:"tool"}`, `none` → инструменты не передаются.
- `max_tokens` обязателен у Anthropic: берётся `max_tokens`/`max_completion_tokens`, иначе 2048. `temperature` пробрасывается.
- `response_format: {type:"json_schema"}` реализован **инструментом-трюком**: добавляется единственный инструмент `koza_json_output` с `input_schema` = схема и `tool_choice: {type:"tool"}`; его `input` возвращается клиенту как `content` (строка JSON), `finish_reason: stop`. В стриме аргументы этого инструмента идут как `delta.content`. `response_format: {type:"json_object"}` — инструкция в `system` («строго один валидный JSON-объект»), без гарантии схемы.
- `image_url` с `data:` URL → `image/base64`, с http(s) → `image/url`.

### Конвертация Anthropic → OpenAI

`content` = склейка текстовых блоков; `tool_use` → `tool_calls[]` с `arguments` как JSON-строкой; `stop_reason`: `end_turn`/`stop_sequence` → `stop`, `max_tokens` → `length`, `tool_use` → `tool_calls`; `usage`: `input_tokens` → `prompt_tokens`, `output_tokens` → `completion_tokens`.

### Streaming

При `stream: true` тело Anthropic (SSE) перекодируется на лету через `TransformStream` без буферизации: `message_start` → первый chunk с `role`; `text_delta` → `delta.content`; `tool_use` → `delta.tool_calls` с `index`, `id`, `name` и накоплением `arguments` из `input_json_delta`; `message_delta` → `finish_reason` и `usage`; `message_stop` → `data: [DONE]`. Заголовки: `Content-Type: text/event-stream`, `Cache-Control: no-cache`, `X-Accel-Buffering: no`. Если апстрим оборвался без `message_stop`, `[DONE]` добавляется при закрытии.

### Fallback

При 429/5xx или сетевой ошибке Anthropic — один вызов Workers AI (без stream, с текстовыми `messages`) и заголовки `X-Koza-Fallback: workers-ai`, `X-Koza-Fallback-Reason: upstream_503|network_error|…`; в Telegram уходит алерт (cooldown 5 мин). При 400/401/403 fallback не делается: возвращается статус апстрима и санитизированное тело (`error.provider: anthropic`, ключи вырезаны). Клиент, запросивший `stream: true`, при fallback получает обычный JSON — `invokeLLMStream` в приложении это учитывает.

## Bindings и secrets

| Имя | Тип | Обязательность | Откуда взять |
|---|---|---|---|
| `AI` | Workers AI binding | обязательно | `wrangler.jsonc` |
| `OPENAI_PROXY_SECRET` | secret | обязательно | тот же секрет, что `OPENAI_API_KEY` в `.env` на VDS (приложение шлёт его как `Bearer`) |
| `ANTHROPIC_API_KEY` | secret | обязательно | Anthropic Console → API keys |
| `AI_GATEWAY_URL` | secret | обязательно | Dashboard → AI → AI Gateway → gateway → API endpoint, вида `https://gateway.ai.cloudflare.com/v1/<account_id>/<gateway_id>` (без `/anthropic`) |
| `ANTHROPIC_MODEL_SONNET` | secret | обязательно | `claude-sonnet-5` |
| `ANTHROPIC_MODEL_HAIKU` | secret | обязательно | `claude-haiku-4-5` |
| `AI_GATEWAY_TOKEN` | secret | **необязательно** | Dashboard → AI Gateway → gateway → Authentication (если включена); заголовок `cf-aig-authorization`. Схема wrangler допускает только `secrets.required`, поэтому в `wrangler.jsonc` не объявлен |
| `ALERT_BOT_TOKEN`, `ALERT_CHAT_ID` | secret | для алертов | Telegram bot и чат для operational alerts |
| `PROXY_SECRET` | secret | для Telegram proxy | авторизация catch-all маршрута |

Значения secrets в Git не хранятся. Для локальной разработки скопируйте `.dev.vars.example` в `.dev.vars`.

## Локальная проверка

```bash
cd cloudflare/tg-proxy
pnpm install
pnpm validate                       # node --check + node --test (32 теста, сеть и env.AI замоканы)
pnpm exec wrangler deploy --dry-run # сборка бандла, проверка bindings; ничего не публикует
```

Локальный запуск с реальными провайдерами (тратит квоту Workers AI и токены Anthropic):

```bash
cp .dev.vars.example .dev.vars   # заполнить
pnpm dev                          # http://localhost:8787
```

Проверка stream через curl (chunks приходят по мере генерации, в конце `data: [DONE]`):

```bash
curl -N http://localhost:8787/openai/v1/chat/completions \
  -H "Authorization: Bearer $OPENAI_PROXY_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"model":"claude-sonnet","stream":true,"messages":[{"role":"user","content":"Скажи привет в трёх словах"}]}'
```

Без stream и с инструментом:

```bash
curl -s http://localhost:8787/openai/v1/chat/completions \
  -H "Authorization: Bearer $OPENAI_PROXY_SECRET" -H "Content-Type: application/json" \
  -d '{"model":"claude-haiku","messages":[{"role":"user","content":"Какая погода в Москве?"}],
       "tools":[{"type":"function","function":{"name":"get_weather","parameters":{"type":"object","properties":{"city":{"type":"string"}},"required":["city"]}}}],
       "tool_choice":"auto"}' -D - | sed -n '1,20p'
```

Транскрипция:

```bash
curl -s http://localhost:8787/openai/v1/audio/transcriptions \
  -H "Authorization: Bearer $OPENAI_PROXY_SECRET" \
  -F file=@voice.ogg -F model=whisper-1
```

## Публикация (только владелец)

```bash
cd cloudflare/tg-proxy
pnpm validate && pnpm exec wrangler deploy --dry-run
pnpm exec wrangler secret put ANTHROPIC_API_KEY
pnpm exec wrangler secret put AI_GATEWAY_URL
pnpm exec wrangler secret put ANTHROPIC_MODEL_SONNET   # claude-sonnet-5
pnpm exec wrangler secret put ANTHROPIC_MODEL_HAIKU    # claude-haiku-4-5
pnpm exec wrangler secret put AI_GATEWAY_TOKEN         # только если у Gateway включена аутентификация
pnpm exec wrangler deploy
```

`OPENAI_PROXY_SECRET`, `PROXY_SECRET`, `ALERT_*` уже заданы в Dashboard и не меняются. До `wrangler deploy` приложение продолжает получать ответы Llama; после — Claude через Gateway, а при его недоступности тот же Llama с пометкой в заголовках. Предпочтителен version-first процесс: `wrangler versions upload` → проверить preview → назначить deployment.

Workers Logs включены. Telegram Bot API содержит bot token в URL path, поэтому доступ к логам должен оставаться ограниченным.

## Источники

[1]: https://developers.cloudflare.com/workers/wrangler/configuration/ "Cloudflare Wrangler configuration"
[2]: https://developers.cloudflare.com/workers/configuration/secrets/ "Cloudflare Workers secrets"
[3]: https://developers.cloudflare.com/workers-ai/get-started/workers-wrangler/ "Workers AI binding with Wrangler"
[4]: https://developers.cloudflare.com/ai-gateway/usage/providers/anthropic/ "AI Gateway: Anthropic provider"
[5]: https://platform.claude.com/docs/en/models/overview "Anthropic Models overview"
[6]: https://platform.claude.com/docs/en/api/versioning "Anthropic API versions"
