# Задача-напоминание: закрыть Telegram-прокси Worker секретом

**Статус (9 сентября 2026): открыто.** Catch-all маршрут Worker `tg-proxy` (`/bot<TOKEN>/…`, `/file/bot<TOKEN>/…`)
проверяет заголовок `X-Proxy-Secret` только если secret `PROXY_SECRET` задан. Сервер (VDS) этот заголовок
сейчас **не отправляет**, поэтому `PROXY_SECRET` исключён из `secrets.required` в `wrangler.jsonc`: с ним
Worker отвергал бы все запросы приложения к Telegram.

**Риск:** без секрета Telegram-прокси — открытый ретранслятор. Любой, кто знает hostname Worker и bot token,
может слать запросы к Bot API от имени бота через Worker; сам token в URL прокси не раскрывает, но лимиты
запросов и логи Worker (URL с token) становятся общими.

## Как закрыть

1. Сервер: добавить env `TELEGRAM_PROXY_SECRET` в `server/_core/env.ts` и в `.env` на VDS (через
   `deploy.yml` → `VDS_ENV_FILE`/secrets), а в клиенте Telegram Bot API (`grammy`/`fetch` в
   `server/telegramBot.ts` и `voiceTranscription.ts` для `/file/bot…`) отправлять `X-Proxy-Secret: <значение>`
   на все запросы к `TELEGRAM_API_PROXY_URL`.
2. Worker: `pnpm exec wrangler secret put PROXY_SECRET` тем же значением; вернуть `PROXY_SECRET` в
   `secrets.required` и в `.dev.vars.example` как обязательный; в тесте `worker.test.mjs` уже есть проверка
   отказа без заголовка — добавить проверку, что запрос с верным секретом проходит.
3. Порядок включения: сначала деплой сервера с заголовком, затем secret в Worker (иначе бот
   потеряет Telegram до следующего деплоя).

Проверка: `curl -s https://<worker>/bot0:fake/getMe` без заголовка должен отвечать 403 после включения.
