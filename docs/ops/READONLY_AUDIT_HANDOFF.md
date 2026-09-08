# Передача одноразового VDS audit и TiDB migration rehearsal

> **Обновление 2026-09-08.** Предпосылка этого документа — что production живёт в managed TiDB — неверна:
> production-база это MySQL 8 на самом VDS (`localhost:3306`, база `sherkozu`), а managed TiDB была
> dev-базой Manus. Из workflow удалены разделы 2–3 (доставка и inputs managed-dump'а) и шаги import/rehearsal
> (разделы 5 п. 4, 7 `migration-rehearsal-results`, 8): остались read-only аудит VDS с копией `uploads` и архив
> CloudFront-ассетов. Скрипт `run-managed-tidb-rehearsal.mjs` удалён. Бэкап и restore-test production-базы —
> `docs/ops/BACKUP.md`; шаг CloudFront читает базу `test`, которую наполняет restore-test.

**Автор:** Manus AI  
**Статус:** шаблон подготовлен, но не активирован в GitHub Actions  
**Шаблон:** `docs/ops/readonly-audit.workflow.yml`

## 1. Назначение и границы

Шаблон запускается только вручную через `workflow_dispatch`. Он сравнивает SHA-256 `DATABASE_URL` из GitHub Secret со значением на VDS, читает fingerprints публичных SSH-ключей и backup metadata, копирует `/var/www/sherkozu/uploads`, восстанавливает зашифрованный managed-TiDB dump в отдельную базу `test` кластера `koza-rehearsal`, проверяет baseline `0066`, пропуск `0021`/`0060a`, миграции и строки 96 таблиц. Затем он скачивает 29 CloudFront-ассетов и готовит SQL замены URL **без выполнения SQL замены**.

> Workflow не выполняет записи на VDS, не перезапускает PM2/nginx и не меняет production-базу. Единственная база, в которую он пишет, — база `test`, указанная в `REHEARSAL_DATABASE_URL`.

GitHub обрабатывает `workflow_dispatch` только когда workflow находится в `.github/workflows/` default branch.[1] Поэтому файл намеренно хранится как обычный документ и должен быть перенесён владельцем через отдельный PR.

## 2. Откуда workflow получает dump

Репозиторий `Shipelov/sher-kozu-website` публичный, поэтому прикреплять backup к GitHub Release этого репозитория нельзя: release asset станет публично доступен. GitHub Secrets также не подходят для 2,37-МБ файла: стандартный лимит secret составляет 48 КБ; официальный workaround — хранить зашифрованный файл отдельно, а passphrase — в Secret.[2]

Принят следующий безопасный вариант: владелец один раз загружает уже зашифрованный файл на VDS в **непубличный** каталог, например:

```text
/var/backups/sherkozu/sherkozu-managed-tidb-2026-09-07.tar.gz.gpg
```

Workflow копирует файл с VDS командой `scp`, проверяет внешний SHA-256, расшифровывает GPG через `MANAGED_DUMP_PASSPHRASE`, затем проверяет внутренний `SHA256SUMS`. Сам workflow на VDS ничего не записывает.

| Параметр backup | Значение |
|---|---|
| Имя файла | `sherkozu-managed-tidb-2026-09-07.tar.gz.gpg` |
| Размер | `2 372 634` байта |
| SHA-256 encrypted file | `f9d6af43b77fb4e898014c0a4979f575fdc09a86d976eb27180cb05f8e43275a` |
| Содержимое после расшифровки | full/schema/data SQL, manifest, compatibility report, `SHA256SUMS`, restore README |
| Passphrase | хранится только в GitHub Secret `MANAGED_DUMP_PASSPHRASE`; в репозиторий не добавляется |

До запуска владелец должен загрузить `.gpg` на VDS и ограничить чтение файла пользователем, указанным в `SSH_USER`. Эти подготовительные действия выполняются вручную, не workflow.

## 3. Workflow inputs

| Input | Обязателен | Значение для первого запуска | Назначение |
|---|---:|---|---|
| `confirm` | Да | `RUN_REHEARSAL` | Явный safety gate |
| `managed_dump_vds_path` | Да | `/var/backups/sherkozu/sherkozu-managed-tidb-2026-09-07.tar.gz.gpg` | Непубличный абсолютный путь encrypted dump на VDS |
| `managed_dump_sha256` | Да | `f9d6af43b77fb4e898014c0a4979f575fdc09a86d976eb27180cb05f8e43275a` | Проверка файла до расшифровки |
| `expected_table_count` | Да | `96` | Safety gate dump/target schema |
| `expected_cloudfront_occurrences` | Да | `29` | Safety gate media inventory |

## 4. GitHub Secrets

Workflow читает только следующие Secrets:

| Secret | Использование | Может попасть в лог |
|---|---|---:|
| `SSH_HOST` | SSH/SCP адрес VDS | Нет; GitHub маскирует Secret |
| `SSH_USER` | SSH user для read-only команд | Нет |
| `SSH_PRIVATE_KEY` | Временный файл ключа runner с mode `600` | Нет |
| `DATABASE_URL` | Только локальный SHA-256; соединение с managed DB не открывается | Нет |
| `REHEARSAL_DATABASE_URL` | Единственное SQL-соединение для import/baseline/validation; имя базы обязано быть `test` | Нет |
| `MANAGED_DUMP_PASSPHRASE` | Расшифровка input dump и шифрование VDS/CloudFront artifacts | Нет |

Workflow **не читает** OpenAI, Cloudflare, Telegram, Bitrix24, Yandex Maps, OAuth или production deployment secrets.

## 5. Задание для Claude Code

Создать отдельную ветку и выполнить только эти изменения:

```text
1. Скопировать docs/ops/readonly-audit.workflow.yml в
   .github/workflows/one-time-migration-rehearsal.yml без изменения содержимого.
2. Убедиться, что scripts/ci/run-vds-readonly-audit.sh,
   scripts/ci/run-managed-tidb-rehearsal.mjs и
   scripts/ci/archive-cloudfront-assets.mjs присутствуют в ветке.
3. Не менять production code, deploy.yml, secrets, VDS или базы.
4. Запустить локально:
   bash -n scripts/ci/run-vds-readonly-audit.sh
   node --check scripts/ci/run-managed-tidb-rehearsal.mjs
   node --check scripts/ci/archive-cloudfront-assets.mjs
   node scripts/ci/run-managed-tidb-rehearsal.mjs --self-test
   node scripts/ci/archive-cloudfront-assets.mjs --self-test
   pnpm vitest run server/migrationRehearsalWorkflow.test.ts
5. Открыть PR с заголовком:
   [skip deploy] Add one-time migration rehearsal workflow
6. Не запускать workflow из PR. После merge владелец запускает его вручную из Actions.
```

Если текущий `deploy.yml` не поддерживает `[skip deploy]`, PR следует объединять в окно, когда допустим штатный повторный deploy неизменённого application code. Сам rehearsal workflow deploy не выполняет.

## 6. Запуск владельцем

После merge workflow в default branch:

1. Открыть **Actions → One-time VDS audit and TiDB rehearsal → Run workflow**.
2. Выбрать `main`.
3. Ввести inputs из раздела 3.
4. Проверить, что `REHEARSAL_DATABASE_URL` указывает на пустую базу с именем `test`.
5. Запустить workflow один раз. Повторный запуск на непустой `test` остановится safety gate.

## 7. Ожидаемые artifacts, срок 7 дней

| Artifact | Открытая часть | Зашифрованная часть |
|---|---|---|
| `migration-rehearsal-results` | timings, migration/check logs с redaction, row diff, VDS/media summaries | Нет бизнес-данных |
| `vds-readonly-audit-encrypted` | summary и checksums | `vds-audit.tar.gz.gpg`, `vds-uploads.tar.gz.gpg` |
| `cloudfront-assets-encrypted` | summary и checksum | 29 файлов, URL manifest и prepared-only SQL в `cloudfront-assets.tar.gz.gpg` |

Artifacts хранятся 7 дней. Для расшифровки используется тот же passphrase:

```bash
gpg --decrypt vds-uploads.tar.gz.gpg > vds-uploads.tar.gz
gpg --decrypt vds-audit.tar.gz.gpg > vds-audit.tar.gz
gpg --decrypt cloudfront-assets.tar.gz.gpg > cloudfront-assets.tar.gz
```

## 8. Проверки, которые считаются успешной rehearsal

| Проверка | Ожидаемый результат |
|---|---|
| Encrypted dump SHA-256 | Совпадает с input |
| Внутренний `SHA256SUMS` | Все файлы `OK` |
| Target DB safety | Database name `test`; до import 0 tables |
| Import | 96 tables |
| Physical migration `0066` | 22 колонки и 4 индекса уже существуют |
| Baseline ledger | Ровно одна новая запись `0066`, она имеет максимальный timestamp |
| `0021` и `0060a` | Timestamp отсутствует в ledger, меньше `0066`; schema/ledger до и после migrate идентичны |
| `drizzle-kit migrate` | No-op |
| `drizzle-kit check` | Успешная проверка migration metadata |
| Row parity | `normalizedDifference = 0` для всех 96 таблиц |
| CloudFront | 29/29 скачаны; 29 replacement statements подготовлены; 0 выполнены |
| VDS | 0 mutations |

## 9. Cleanup

После передачи artifacts Manus и подготовки `MIGRATION_REHEARSAL.md` файл `.github/workflows/one-time-migration-rehearsal.yml` удаляется отдельным PR/commit. Шаблон в `docs/ops` и scripts можно сохранить как audit trail либо удалить отдельным решением владельца.

## References

[1]: https://docs.github.com/en/actions/writing-workflows/choosing-when-your-workflow-runs/events-that-trigger-workflows#workflow_dispatch "GitHub Docs — workflow_dispatch"
[2]: https://docs.github.com/en/actions/security-for-github-actions/security-guides/using-secrets-in-github-actions#storing-large-secrets "GitHub Docs — Storing large secrets"
