# Cloudflare Worker `tg-proxy`

Этот каталог содержит экспорт активного Cloudflare Worker `tg-proxy`. Исходник скопирован из авторизованного Dashboard 7 сентября 2026 года; активной на момент экспорта была версия `f364d3ca`. Экспорт не изменял и не публиковал production Worker. Проверяемые сведения о происхождении файла и контрольные суммы находятся в [`export-metadata.json`](./export-metadata.json).

## Назначение и маршруты

Worker является сетевым шлюзом для Telegram и Workers AI. Фактический switch маршрутов находится в [`src/worker.js`](./src/worker.js).

| Маршрут | Назначение | Защита |
|---|---|---|
| `GET /health` | Проверка Telegram API, Workers AI binding и VDS | Публичный диагностический ответ без секретов |
| `POST /openai/v1/chat/completions` | OpenAI-compatible adapter к Workers AI | Разрешённый IP VDS или `X-OpenAI-Proxy-Secret` |
| `/sdk/*` | Proxy Telegram Web App SDK | Публичный read-only proxy |
| `/webhook/*` | Relay webhook на `https://koza.vip` | Передаёт только allowlisted headers; конечный сервер проверяет Telegram secret header |
| Остальные пути | Telegram Bot API/file proxy | `X-Proxy-Secret`, если `PROXY_SECRET` настроен |

Модель выбирается самим Worker и сейчас жёстко зафиксирована как `@cf/meta/llama-3.1-8b-instruct-fast`. Поле `model` во входном OpenAI-compatible payload не определяет фактическую модель.

## Bindings и secrets

| Имя | Тип | Обязательность | Назначение |
|---|---|---|---|
| `AI` | Workers AI binding | Обязательно | Вызов `env.AI.run(...)` |
| `ALERT_BOT_TOKEN` | Secret | Обязательно для alerts | Telegram bot для operational alerts |
| `ALERT_CHAT_ID` | Secret | Обязательно для alerts | Получатель operational alerts |
| `OPENAI_PROXY_SECRET` | Secret | Обязательно для переносимости | Резервная авторизация AI route, если IP VDS изменится |
| `PROXY_SECRET` | Secret | Обязательно для безопасного Telegram proxy | Авторизация catch-all Telegram API route |

Значения secrets намеренно отсутствуют в Git. Для локальной разработки скопируйте `.dev.vars.example` в `.dev.vars` и заполните значения через защищённый канал. Файлы `.dev.vars*`, кроме примера, игнорируются Git.

## Локальная проверка

```bash
cd cloudflare/tg-proxy
pnpm install
pnpm validate
```

Тесты не обращаются к внешним API: `fetch` и Workers AI binding подменяются локальными заглушками. Команда `pnpm dev` может использовать удалённый Workers AI и расходовать квоту Cloudflare; запускайте её только осознанно.

## Безопасная публикация

Wrangler config является source of truth для кода, binding `AI`, observability и списка обязательных secret names. Сначала выполняйте локальные проверки и dry run:

```bash
cd cloudflare/tg-proxy
pnpm validate
pnpm exec wrangler deploy --dry-run
```

Production deployment не запускается автоматически из корневого проекта. Перед первым управляемым deploy необходимо проверить значения secrets в **Cloudflare Dashboard → Workers & Pages → tg-proxy → Settings → Variables and Secrets**. Не переносите secret values в `wrangler.jsonc`, `.env`, документацию или GitHub workflow literals.

После отдельного подтверждения владельца предпочтителен version-first процесс: загрузить новую версию через `wrangler versions upload`, проверить preview и только затем назначить deployment. Не используйте `wrangler deploy` как пробную команду: она изменяет production.

## Известные ограничения экспортированной версии

Файл хранится как точная копия активного Dashboard source. Поэтому `TARGET_ORIGIN` и разрешённый IP VDS заданы константами. Это не секреты, но при переносе инфраструктуры их следует перевести в non-secret vars и покрыть отдельным изменением с тестами. Маршрут `/webhook/*` остаётся общим relay на `koza.vip`; конечные endpoints должны продолжать проверять собственную подпись или secret header.

Workers Logs включены. Telegram Bot API обычно содержит bot token в URL path, поэтому доступ к Cloudflare logs должен оставаться ограниченным, а экспорт логов — исключать URL paths с credentials.

## Источники

[1]: https://developers.cloudflare.com/workers/wrangler/configuration/ "Cloudflare Wrangler configuration"
[2]: https://developers.cloudflare.com/workers/configuration/secrets/ "Cloudflare Workers secrets"
[3]: https://developers.cloudflare.com/workers-ai/get-started/workers-wrangler/ "Workers AI binding with Wrangler"

Конфигурация следует актуальным требованиям Cloudflare: обязательны `name`, `main` и `compatibility_date`; Workers AI подключается через binding `AI`; секреты объявляются по именам и хранятся отдельно от Git. [1] [2] [3]
