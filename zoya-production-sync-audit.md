# Аудит production-синхронизации Зои

Дата проверки: 2026-09-06.

## Подтверждённые факты

Локальный `HEAD` и `user_github/main` совпадают с финальным чекпоинтом `855fb31ccf8edb04e5b161e757fcd613ced61342`.

Production endpoint `https://koza.vip/api/version` возвращает `commit: unknown` и `buildTime: unknown`, потому что прежний deploy workflow записывал SHA только в `.deploy_version`, но не передавал `GIT_COMMIT` и `BUILD_TIME` процессу PM2.

Новая защищённая процедура `nutritionist.profiles.list` существует на koza.vip и отвечает ожидаемым `401 UNAUTHORIZED`, то есть VDS получил часть перестройки мультипрофилей.

Однако точный production SSE-запрос `Зоя мне нужно меню на завтра с моими продуктами` возвращает meta-событие только с `userType`, без обязательного `profileContext`, а затем запускает общий AI. Финальный код чекпоинта `855fb31c` всегда добавляет `profileContext` и для такого `personal_menu` должен вернуть `needs_authentication` до AI. Следовательно, koza.vip обслуживает промежуточную сборку, а не финальный runtime.

## Исправление проверяемости

Deploy workflow теперь передаёт `GIT_COMMIT` и `BUILD_TIME` в `.env` и PM2. После следующего успешного VDS deploy `/api/version` должен однозначно показать опубликованный commit.

## Критерий успешной синхронизации

Production считается синхронизированным только если `/api/version` возвращает новый commit, SSE meta содержит `profileContext`, а гостевой персональный запрос завершается profile gate без обращения к внешнему AI.
