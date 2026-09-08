# Дамп владельца с managed-базы и репетиция миграции

**Workflow:** `.github/workflows/owner-dump-and-rehearsal.yml` (только `workflow_dispatch`, input `confirm=RUN`).
**Зачем:** дамп Manus (самописный скрипт) содержит испорченные JSON-колонки
(`[object Object]`, массивы через запятую, `,,,` вместо NULL) и не импортируется.
Этот путь снимает дамп стандартным инструментом прямо с managed-базы и проверяет
миграции на кластере `koza-rehearsal` независимо от дампа Manus. Сценарий Manus
(`one-time-migration-rehearsal.yml`, аудит VDS и CloudFront) остаётся отдельным.

## Что делает workflow

| Шаг | Что происходит | Пишет в |
|---|---|---|
| Parse URLs | `scripts/ci/db-url-parts.mjs` разбирает `DATABASE_URL` и `REHEARSAL_DATABASE_URL` через `new URL()` (схемы `mysql://` и `mysql2://`, `decodeURIComponent` для user/password, query игнорируется); host/port/user/db → `GITHUB_ENV`, пароль → файл mode 600 и option-файл mysql с `ssl-mode=REQUIRED`; user и пароль маскируются, в лог идут только host, port и имя базы | `$RUNNER_TEMP` |
| Guard + connectivity | имя базы источника ≠ `test`, репетиции = `test`, адреса различаются; `scripts/ci/db-connectivity-check.mjs` подключается через mysql2 к обоим URL и печатает `VERSION()`, число таблиц и первые пять имён — доказательство, что URL рабочие, до внешних утилит | только чтение |
| Dump | TiDB Dumpling из `tidb-community-toolkit` (`download.pingcap.com`, ~1 ГБ; sha256 сверяется с опубликованным `.sha256` и с закреплённым `toolkit_sha256`, из архива извлекается только `dumpling-<version>-linux-amd64.tar.gz`): `--filetype sql --consistency snapshot` (или `none`), TLS через `--ca`, пароль подставляется из файла флагом `-p` (env и конфига для пароля у Dumpling нет, проверено по `dumpling/export/config.go`); файлы схемы и данных склеиваются в один SQL. Если Dumpling падает и `dump_tool=auto` — `mysqldump --skip-lock-tables --skip-add-locks --set-gtid-purged=OFF --hex-blob --column-statistics=0 --no-tablespaces` **без** `--single-transaction`: mysqldump 8 с ним падает на `ROLLBACK TO SAVEPOINT`, которого в TiDB нет; снимок fallback-а не консистентный | только чтение |
| Verify | `scripts/ci/verify-owner-dump.mjs`: число `CREATE TABLE` = `expected_table_count`, файл завершён (`-- Dump completed` у mysqldump, `;` у Dumpling), нет `[object Object]` и `,,,` | — |
| Encrypt | gpg AES-256 с `MANAGED_DUMP_PASSPHRASE`, sha256 encrypted и plaintext | artifact `owner-managed-dump-encrypted`, 7 дней |
| Reset | `scripts/ci/reset-rehearsal-db.mjs`: DROP всех таблиц; отказ, если база не `test` или адрес совпадает с `DATABASE_URL` | база `test` |
| Import | `mysql < owner-dump.sql` через option-файл — для ~5 МБ проще и надёжнее TiDB Lightning | база `test` |
| Rehearsal | `scripts/ci/run-owner-dump-rehearsal.mjs` → `rehearsalLib.mjs`: physical 0066, baseline 0066 в `__drizzle_migrations`, `drizzle-kit migrate` (ожидается no-op с пропуском 0021/0060a по timestamp), `drizzle-kit check`, `COUNT(*)` по всем таблицам источника (только SELECT) против `test` | база `test`; источник — только чтение |
| Results | `rehearsal-result.json`, `row-diff.json`, логи migrate/check с redaction, `dump-verification.json`, тайминги шагов | artifact `migration-rehearsal-results`, 7 дней |
| Cleanup (`always()`) | option-файлы, passphrase, plaintext дампа, toolkit | — |

## Inputs

| Input | По умолчанию | Назначение |
|---|---|---|
| `confirm` | — | `RUN` |
| `expected_table_count` | `96` | Safety gate для дампа, источника и цели |
| `dump_tool` | `auto` | `dumpling` без fallback, `mysqldump` сразу |
| `dumpling_version` | `v8.5.1` | версия toolkit с Dumpling |
| `toolkit_sha256` | `49a67fefb2f2ade52160b5c8dea8f70dc5fada4845f30751d74a59eecd212a41` | закреплённый sha256 архива toolkit v8.5.1; пусто = доверять только опубликованному `.sha256` (workflow предупредит) |
| `dumpling_consistency` | `snapshot` | `--consistency` Dumpling: `snapshot` через `tidb_snapshot` или `none` |
| `strict_row_parity` | `false` | падать при расхождении `COUNT(*)`; по умолчанию расхождение только фиксируется в `row-diff.json`, потому что живая база меняется между дампом и подсчётом |

## Проводка переменных

На уровне job задано `SOURCE_DATABASE_URL: ${{ secrets.DATABASE_URL }}` (managed-база) и `REHEARSAL_DATABASE_URL: ${{ secrets.REHEARSAL_DATABASE_URL }}` (база `test`); все скрипты читают ровно эти имена (`--env SOURCE_DATABASE_URL` / `--env REHEARSAL_DATABASE_URL`). Пустая или отсутствующая переменная — ошибка «переменная X не задана или пуста» без вывода значения; неразбираемая строка — ошибка с длиной, первыми 8 символами (после `:`/`@` маскируются) и числом `@`.

## Известная проблема: secret `DATABASE_URL` указывает на localhost

Запуск 2026-09-08 показал в шаге «Parse database URLs»: `SOURCE_DATABASE_URL: scheme=mysql host=localhost port=3306 … user=<8 chars>`. Это не дефолт парсера (порт по умолчанию у него 4000, пустой host отклоняется), а содержимое самого секрета: `deploy.yml` записывает `secrets.DATABASE_URL` в `.env` на VDS, то есть приложение работает с базой на `localhost:3306` самого VDS. С GitHub-раннера этот адрес недостижим, и Dumpling/mysqldump до базы не дойдут. Варианты: (а) снимать дамп на VDS по SSH (`VDS_HOST`/`VDS_USER`/`VDS_SSH_KEY`, как в `run-vds-readonly-audit.sh`) и забирать файл `scp`; (б) SSH-туннель с раннера (`ssh -L 3306:127.0.0.1:3306`) и Dumpling против `127.0.0.1:3306`; (в) отдельный secret с сетевым адресом managed-базы, если она существует. Решение за владельцем; до него `Guard database names` и «Check connectivity» останавливают workflow с понятным сообщением.

## Secrets

`DATABASE_URL` (только чтение: mysqldump и `SELECT COUNT(*)`), `REHEARSAL_DATABASE_URL`
(имя базы обязано быть `test`), `MANAGED_DUMP_PASSPHRASE`. VDS-секреты не читаются.

## Загрузка Dumpling и проверка целостности

Бинарники PingCAP публикует на `download.pingcap.com` (см. [Download TiDB Tools](https://docs.pingcap.com/tidb/stable/download-ecosystem-tools/)); хост `download.pingcap.org` не резолвится. Архив `tidb-community-toolkit-<version>-linux-amd64.tar.gz` весит около 1 ГБ, рядом лежит `.sha256` с голым хэшем. Workflow сверяет скачанный архив с опубликованным хэшем **и** с хэшем из input `toolkit_sha256`, затем извлекает из архива только `dumpling-<version>-linux-amd64.tar.gz`.

Закреплённый хэш защищает от подмены обоих файлов на зеркале. При смене `dumpling_version` владелец обновляет его так:

```bash
VER=v8.5.1
curl -fsSL "https://download.pingcap.com/tidb-community-toolkit-${VER}-linux-amd64.tar.gz.sha256"
# сверить с независимым источником (другая машина/сеть или локально скачанный архив):
curl -fsSL -o toolkit.tar.gz "https://download.pingcap.com/tidb-community-toolkit-${VER}-linux-amd64.tar.gz" && sha256sum toolkit.tar.gz
```

Полученное значение подставить в default input `toolkit_sha256` в workflow (и в эту таблицу) или передать в поле при запуске.

## Расшифровка страховой копии

```bash
sha256sum -c owner-dump.sql.gpg.sha256
gpg --decrypt owner-dump.sql.gpg > owner-dump.sql
sha256sum -c owner-dump.plaintext.sha256
```

## Локальные проверки

```bash
node scripts/ci/db-url-parts.mjs --self-test
SOURCE_DATABASE_URL=… node scripts/ci/db-connectivity-check.mjs --env SOURCE_DATABASE_URL --label local
node scripts/ci/verify-owner-dump.mjs --self-test
node scripts/ci/run-owner-dump-rehearsal.mjs --self-test
REHEARSAL_DATABASE_URL=… node scripts/ci/reset-rehearsal-db.mjs --dry-run
pnpm vitest run server/ownerDumpRehearsalWorkflow.test.ts server/dbUrlParts.test.ts
```

mysqldump против боевой базы локально не запускать.
