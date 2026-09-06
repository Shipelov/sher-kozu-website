# Аудит production-синхронизации Зои

Дата проверки: 2026-09-06.

## Подтверждённые факты

Локальный `HEAD` и `user_github/main` совпадают с финальным чекпоинтом `855fb31ccf8edb04e5b161e757fcd613ced61342`.

Production endpoint `https://koza.vip/api/version` возвращает `commit: unknown` и `buildTime: unknown`, потому что прежний deploy workflow записывал SHA только в `.deploy_version`, но не передавал `GIT_COMMIT` и `BUILD_TIME` процессу PM2.

Новая защищённая процедура `nutritionist.profiles.list` существует на koza.vip и отвечает ожидаемым `401 UNAUTHORIZED`, то есть VDS получил часть перестройки мультипрофилей.

Однако точный production SSE-запрос `Зоя мне нужно меню на завтра с моими продуктами` возвращает meta-событие только с `userType`, без обязательного `profileContext`, а затем запускает общий AI. Финальный код чекпоинта `855fb31c` всегда добавляет `profileContext` и для такого `personal_menu` должен вернуть `needs_authentication` до AI. Следовательно, koza.vip обслуживает промежуточную сборку, а не финальный runtime.

## Исправление проверяемости

GitHub App не имеет разрешения изменять `.github/workflows/*`, поэтому version-маркировка перенесена в приложение. Endpoint `/api/version` теперь читает commit из существующего файла `.deploy_version`, который прежний VDS workflow уже создаёт при каждом deploy, а время сборки — из времени изменения этого файла. Изменять workflow для этого не требуется.

## Критерий успешной синхронизации

Production считается синхронизированным только если `/api/version` возвращает новый commit, SSE meta содержит `profileContext`, а гостевой персональный запрос завершается profile gate без обращения к внешнему AI.

## Итоговая проверка после исправления workflow

Повторный VDS deploy завершился успешно. Endpoint `/api/version` вернул commit `4c421d929db9acef9b6f86f3fb041fb5f3d540c8`, build time `2026-09-06T16:07:08Z` и `nodeEnv: production`.

`/api/health` вернул `status: ok`, база данных — `connected`, измеренная задержка — 14 мс.

Точный гостевой SSE-запрос `Зоя мне нужно меню на завтра с моими продуктами` больше не запускает свободный AI. Production вернул `profileContext.status: needs_authentication`, действие `login`, затем понятный profile-gate ответ и обязательный `[DONE]`. Вымышленных продуктов в ответе нет.

Страница `/nutritionist` загружает новый публичный текст и безопасные формулировки об аллергии. Browser console пуст; основные API и статические ресурсы загрузились без зафиксированных ошибок.
