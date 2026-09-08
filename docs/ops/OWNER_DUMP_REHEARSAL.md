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
| Prepare option files | `scripts/ci/parse-database-url.sh` разбирает `DATABASE_URL` и `REHEARSAL_DATABASE_URL` в shell без вывода значений; пароли уходят в option-файлы mode 600 с `ssl-mode=REQUIRED`; компоненты маскируются в логе | `$RUNNER_TEMP` |
| Dump | TiDB Dumpling из `tidb-community-toolkit` (`download.pingcap.org`, sha256 сверяется с опубликованным): `--filetype sql --consistency snapshot` (или `none`), TLS через `--ca`; файлы схемы и данных склеиваются в один SQL. Если Dumpling падает и `dump_tool=auto` — `mysqldump --skip-lock-tables --skip-add-locks --set-gtid-purged=OFF --hex-blob --column-statistics=0 --no-tablespaces` **без** `--single-transaction`: mysqldump 8 с ним падает на `ROLLBACK TO SAVEPOINT`, которого в TiDB нет; снимок fallback-а не консистентный | только чтение |
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
| `dumpling_consistency` | `snapshot` | `--consistency` Dumpling: `snapshot` через `tidb_snapshot` или `none` |
| `strict_row_parity` | `false` | падать при расхождении `COUNT(*)`; по умолчанию расхождение только фиксируется в `row-diff.json`, потому что живая база меняется между дампом и подсчётом |

## Secrets

`DATABASE_URL` (только чтение: mysqldump и `SELECT COUNT(*)`), `REHEARSAL_DATABASE_URL`
(имя базы обязано быть `test`), `MANAGED_DUMP_PASSPHRASE`. VDS-секреты не читаются.

## Расшифровка страховой копии

```bash
sha256sum -c owner-dump.sql.gpg.sha256
gpg --decrypt owner-dump.sql.gpg > owner-dump.sql
sha256sum -c owner-dump.plaintext.sha256
```

## Локальные проверки

```bash
bash scripts/ci/parse-database-url.sh --self-test
node scripts/ci/verify-owner-dump.mjs --self-test
node scripts/ci/run-owner-dump-rehearsal.mjs --self-test
REHEARSAL_DATABASE_URL=… node scripts/ci/reset-rehearsal-db.mjs --dry-run
pnpm vitest run server/ownerDumpRehearsalWorkflow.test.ts
```

mysqldump против боевой базы локально не запускать.
