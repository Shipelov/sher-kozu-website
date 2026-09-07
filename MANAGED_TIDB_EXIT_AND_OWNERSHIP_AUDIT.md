# Managed TiDB: резервная копия, выход из Manus и владение инфраструктурой

**Состояние на:** 7 сентября 2026 года  
**Автор:** Manus AI  
**Режим аудита:** read-only; production, Cloudflare, DNS, роли и секреты не изменялись

> **Главный вывод.** Текущий `DATABASE_URL` ведёт в автоматически управляемую WebDev/TiDB Serverless базу Manus. Владелец проекта не имеет отдельного TiDB Cloud‑аккаунта, поэтому передать такую TiDB‑организацию или добавить в неё Organization Owner невозможно. Практический путь — импортировать проверенный логический снимок в новый кластер, который будет создан в аккаунте владельца.

## 1. Резюме для принятия решения

| Вопрос | Подтверждённый ответ |
|---|---|
| Где находится база | TiDB Serverless v8.5.3, AWS `us-east-1`, автоматически управляемый контур WebDev/Manus; customer-owned TiDB organization не обнаружена |
| Это точно production? | Происхождение совпадает с историей настройки VDS, но окончательное равенство текущему VDS secret требует сравнения SHA‑256 fingerprint; значение `DATABASE_URL` не раскрывается |
| Резервная копия | Создан согласованный read-only SQL snapshot: 96 таблиц, 24 798 строк, 4 970 860 байт; gzip 586 504 байта; SHA‑256 проверен [1] |
| Совместимость | Все 95 application tables, типы, nullability, autoincrement, PK и indexes совпадают с Drizzle snapshot; есть один безопасно сохраняемый extra-column drift [2] |
| Главный риск импорта | Migration ledger содержит 69 записей при 66 локальных migrations; `0066_low_whiplash` физически применена, но не зарегистрирована. Нельзя сразу запускать `drizzle-kit migrate` |
| Оценка простоя | **15–30 минут** при подтверждённом совпадении production и успешной генеральной репетиции; передача 4,97 МБ занимает секунды, время уходит на freeze, baseline, deploy и smoke |
| Что исчезнет с Manus | Managed DB, preview/checkpoints, автоматическое внедрение secrets и гарантии project-scoped CDN/Forge. VDS, Cloudflare Worker, домены, Telegram, Bitrix24 и Yandex Maps сами по себе от Manus не зависят |
| Срок жизни managed DB после подписки | В коде и БД не определён. Договорный срок должен подтвердить Manus Support через <https://help.manus.im>; планировать сохранность после закрытия нельзя |

## 2. TiDB: аккаунт, организация, пользователи, сеть, billing и backups

### 2.1. Владение

В доступной среде нет TiDB connector, customer organization, project name, cluster name, member list или customer billing profile. Управляемая строка подключения создана WebDev‑проектом и затем была использована в VDS/GitHub deployment. Это **не** TiDB‑организация владельца, куда можно пригласить `rusventure@gmail.com`.

TiDB Cloud действительно поддерживает уровни organization/project/resource, но приглашать Organization Owner может только существующий Organization Owner. Такой пользовательский контур для данной базы недоступен. [3]

| Запрошенный атрибут | Результат |
|---|---|
| Email владельца TiDB Cloud | Не существует/не доступен как customer account для этой managed базы |
| Organization / Project / Cluster | Не представлены владельцу; internal managed metadata не раскрывает customer organization |
| Регион | Endpoint указывает AWS `us-east-1` |
| План | Server version сообщает `serverless`; по характеристикам соответствует managed Starter/Serverless, но customer console plan не доступен |
| Участники и роли | Невозможно получить без owning organization console |
| Добавление `rusventure@gmail.com` как Organization Owner | Невозможно: нет управляемой владельцем организации, в которой можно отправить приглашение |
| Передача организации целиком | Неприменима; требуется перенос данных в новую owner-controlled organization/cluster |

### 2.2. SQL‑пользователи и сетевой доступ

Database-side metadata показывает три SQL principal: сгенерированные tenant-prefixed `…root@%`, `…cloud_admin@%` и locked `role_admin@%`. Password hashes не запрашивались. Рабочий `…root@%` имеет широкие права, включая `CREATE USER` и `GRANT OPTION`; после переноса нужен отдельный least-privilege application user.

Endpoint публичный, TLS обязателен, а текущий gateway доступен из sandbox. Это исключает blanket VDS-only restriction, но не заменяет фактическую firewall‑страницу TiDB. Для нового owner-controlled Starter/Essential instance нужно явно разрешить IP VDS и временный IP миграционной машины; GitHub Actions с динамическими адресами не следует разрешать широким `0.0.0.0/0` без необходимости. Официально public endpoints Starter/Essential защищаются firewall rules. [4] [5]

### 2.3. Размер, RU, платежи и backup

| Метрика | Значение |
|---|---:|
| Application tables | 95 |
| Physical tables вместе с migration ledger | 96 |
| Точные строки | 24 798 |
| Table/index size по `information_schema` | 2 530 254 байта, около 2,413 MiB |
| Полный SQL dump | 4 970 860 байт |
| Полный gzip | 586 504 байта |
| Views | 0 |

Monthly RU, карта, payer, invoice history, Cost Explorer и automatic-backup retention недоступны из SQL. Эти данные существуют только в owning organization console. Для обычного Starter TiDB публикует free allowances и ограничения, но нельзя выдавать их за фактическое потребление проекта. [6]

Отдельный подтверждённый manual dump до этого аудита не найден. Текущий snapshot — первая проверенная копия в доступной среде. Restore drill в отдельный реальный MySQL/TiDB target ещё не выполнен: в sandbox нет локального server/Docker, а owner-controlled target пока не создан. Автоматический backup/PITR источника не подтверждён. Для Dedicated TiDB документирует snapshot backup/PITR и retention, но это нельзя автоматически переносить на данный managed Serverless instance. [7]

## 3. Состав резервной копии и проверка совместимости

Raw SQL с пользовательскими данными **не добавлен в Git**. Он хранится локально в приватном каталоге с правами `0700`, файлы — `0600`:

```text
/home/ubuntu/private-backups/sherkozu-managed-tidb-2026-09-07/
├── managed-tidb-full.sql
├── managed-tidb-full.sql.gz
├── managed-tidb-schema.sql
├── managed-tidb-schema.sql.gz
├── managed-tidb-data.sql
├── managed-tidb-data.sql.gz
├── dump-manifest.json
├── compatibility-report.json
└── SHA256SUMS
```

Для передачи подготовлен отдельный симметрично зашифрованный AES‑256 bundle `/home/ubuntu/private-backups/sherkozu-managed-tidb-2026-09-07.tar.gz.gpg`: 2 372 634 байта, SHA‑256 `f9d6af43b77fb4e898014c0a4979f575fdc09a86d976eb27180cb05f8e43275a`. Контрольная расшифровка, распаковка и проверка всех восьми записей `SHA256SUMS` прошли успешно. Passphrase хранится отдельно с правами `0600`, не добавлен в Git и должен передаваться владельцу отдельно от файла.

Snapshot выполнен одной TLS‑проверенной mysql2 connection в `REPEATABLE READ` через `START TRANSACTION WITH CONSISTENT SNAPSHOT`; position `468925827018391612`. Checksum package проходит `sha256sum -c SHA256SUMS`. Credentials, connection URL, password assignment и private keys в SQL не обнаружены. Safe metadata‑копии находятся в [`docs/managed-tidb-dump-manifest.json`](./docs/managed-tidb-dump-manifest.json) и [`docs/managed-tidb-compatibility-report.json`](./docs/managed-tidb-compatibility-report.json). [1] [2]

### 3.1. Schema compatibility

Автоматическая сверка с `drizzle/meta/0066_snapshot.json` дала следующие результаты:

| Проверка | Результат |
|---|---:|
| Tables only in dump | 0 |
| Tables only in Drizzle | 0 |
| Type mismatches после TiDB normalization | 0 |
| Nullability mismatches | 0 |
| Autoincrement mismatches | 0 |
| Primary-key mismatches | 0 |
| Index mismatches | 0 |
| Column drift | 1 |

Единственный drift: `notificationPreferences.productPlanUpdate` существует в базе/dump, но отсутствует в current Drizzle snapshot. Удалять колонку при переносе не нужно. Runtime использует `productPlanUpdate` как notification type, но не читает этот preference field; колонку следует отдельно принять в schema или документированно вывести из эксплуатации.

### 3.2. Migration ledger

| Показатель | Значение |
|---|---:|
| Repository SQL migrations | 66 |
| Journal entries | 66 |
| Database migration rows | 69 |
| Совпадения по timestamp | 65 |
| Из них hash отличается от текущего файла | 14 |
| DB timestamps без текущего journal | 4 |
| Current journal timestamp без DB row | `0066_low_whiplash` |

Последняя зарегистрированная в DB миграция — `0065_freezing_viper`, timestamp `1778241698553`. Миграция `0066_low_whiplash` имеет timestamp `1788700524089`; её таблицы/колонки/indexes уже физически присутствуют. Drizzle MySQL migrator сравнивает только maximum `created_at` с `folderMillis`, поэтому после raw import попытается выполнить `0066` повторно и получит duplicate-column/index errors. [8]

## 4. План переноса и переключения

### 4.1. Подготовка без простоя

1. Создать TiDB Cloud аккаунт на email владельца, организацию и Starter/Essential instance в требуемом регионе. Выдать владельцу Organization Owner; разработчику — минимальную project role.
2. Создать отдельного SQL user только для application schema. Не использовать `root` в runtime.
3. Разрешить firewall для `89.111.165.77/32` и временного migration IP. Подключение выполнять только с TLS verification.
4. Импортировать текущий snapshot как **репетицию** в отдельную target database. TiDB поддерживает импорт SQL через MySQL client. [9]
5. Запустить row counts, schema verifier, авторизацию, основные API и 18 golden AI scenarios на staging-копии.
6. Выгрузить и перенести 29 project-CDN assets, а также создать независимую копию `/var/www/sherkozu/uploads`.
7. Настроить monitoring и независимый backup target до cutover.

### 4.2. Baseline migration ledger на target

После импорта и только после подтверждения physical schema добавьте ledger row для уже применённой `0066`:

```sql
START TRANSACTION;

-- Предварительно подтвердить, что все 22 columns и 4 indexes из
-- drizzle/0066_low_whiplash.sql уже существуют.

INSERT INTO `__drizzle_migrations` (`hash`, `created_at`)
SELECT
  '29e4522198a3fb813b798b5e1b56868b4182cb152dfc378710f2672b5b5bd4f0',
  1788700524089
WHERE NOT EXISTS (
  SELECT 1
  FROM `__drizzle_migrations`
  WHERE `created_at` = 1788700524089
);

COMMIT;
```

Hash относится к current checked-in `drizzle/0066_low_whiplash.sql`. Не переписывайте 14 старых hash rows: Drizzle использует latest timestamp, а историческую целостность следует сохранить в compatibility report. После baseline `pnpm exec drizzle-kit migrate` должен стать no-op; это нужно проверить на rehearsal target до production cutover.

### 4.3. Финальное окно

| Этап | Оценка |
|---|---:|
| Включить maintenance/gate и остановить новые записи | 1–2 мин |
| Сделать финальный consistent snapshot | 1–3 мин |
| Импорт 4,97 МБ в заранее подготовленный target | 1–5 мин |
| Проверить counts/schema и baseline 0066 | 3–7 мин |
| Обновить GitHub Secret `DATABASE_URL` и deploy | 3–7 мин |
| Health/auth/core smoke | 5–10 мин |
| **Плановое окно** | **15–30 мин** |

Оценка условна: сначала необходимо сравнить production VDS `DATABASE_URL` fingerprint с текущим managed URL. Если fingerprint различается, этот dump нельзя считать финальным production dump и нужно повторить экспорт через production credential.

### 4.4. Изменение `DATABASE_URL`

Изменятся hostname, port/public endpoint, tenant username, password, database name и TLS options. Новую строку следует добавить в GitHub Actions Secret `DATABASE_URL`, после чего workflow materializes её на VDS. Не коммитьте URL и не отправляйте её в чат.

До переключения измените deploy flow: для первого target deploy migration должно выполняться **после** импортного baseline либо отдельным preflight, иначе workflow остановится на duplicate 0066. После успешного smoke старый credential сохраняйте только на время rollback window.

### 4.5. Rollback

При проблеме вернуть прежний `DATABASE_URL`, повторно развернуть приложение и проверить `/api/health`. Любые записи, сделанные в новой базе после cutover, не попадут обратно автоматически. Поэтому в первые 15–30 минут после запуска нужно либо сохранять write freeze до smoke, либо иметь отдельный reconciliation plan.

## 5. Что исчезнет или останется при закрытии Manus

| Компонент | Статус после закрытия Manus | Действие |
|---|---|---|
| Managed TiDB | Нельзя считать сохраняемым | Перенести до закрытия и сменить `DATABASE_URL` |
| Development preview/checkpoints | Исчезнут | GitHub + owner-controlled staging/CI |
| Автоматически injected secrets | Исчезнут | GitHub Secrets/provider vault; rotate после передачи |
| Manus project CloudFront assets | Срок не гарантирован | Скачать 29 DB-linked и все runtime source assets, перенести в owner storage |
| VDS `/uploads` | Останутся только пока жив VDS | Backup/restore drill; предпочтительно owner-controlled S3 |
| Direct S3 | Сейчас не настроен | Создать отдельный bucket при миграции media |
| Local email/password login | Останется после переноса DB и сохранения `JWT_SECRET` | Проверить login/register/reset |
| Legacy Manus OAuth callback | Может исчезнуть; основной UI его не использует | Удалить после проверки legacy clients |
| Зоя/Маша text AI | Останется: Cloudflare Workers AI | Сохранить Worker/secrets/quota; добавить CI/monitoring |
| Telegram | Останется | Передать BotFather ownership/token/admin chat |
| Bitrix24 email/CRM | Останется, если сохранён портал | Подтвердить billing/owner; исправить OTP logging |
| Yandex Maps | Останется, если сохранён key/account | Подтвердить owner/billing/domain allowlist |
| Product/site analytics | Останется после переноса TiDB | Проверить history/counts |
| Forge storage/notifications | Legacy fallback исчезнет | Удалить или заменить; production already prefers VDS/Telegram |

Media inventory без raw user URLs находится в [`docs/managed-media-origin-inventory.json`](./docs/managed-media-origin-inventory.json): в current managed DB обнаружено 29 ссылок на project CloudFront и 12 ссылок `koza.vip`; populated direct-S3 origins нет. [10]

## 6. Владение внешними сервисами

| Сервис | Аккаунт/email | Подтверждённый владелец | Кто платит | Как передать |
|---|---|---|---|---|
| Managed TiDB/WebDev DB | Customer account отсутствует | Manus-managed project resource | В составе Manus service; billing details недоступны | SQL export/import в новый owner-controlled TiDB |
| Cloudflare / `tg-proxy` / Workers AI | `shipelovspain@gmail.com` | Подтверждено пользователем; единственный видимый Super Admin | Не проверялось по указанию пользователя | Передача не требуется; сохранить 2FA/recovery и Worker source |
| VDS | Network operator RU-CENTER/NIC.RU | Customer account не подтверждён | Не подтверждено | Передать RU-CENTER account или создать новый VDS; добавить named SSH key владельца |
| `sherkozu.ru` | Registrar RU-CENTER; DNS Cloudflare | Registrant redacted | Не подтверждено | Проверить RU-CENTER cabinet; домен оплачен до 07.04.2027 |
| `koza.vip` | Registrar/DNS RU-CENTER | Registrant redacted | Не подтверждено | Проверить RU-CENTER cabinet; expiry 07.04.2027; transfer lock active |
| GitHub | `Shipelov/sher-kozu-website`; commits `rusventure@gmail.com` | Namespace owner `Shipelov` | Для public repository отдельная оплата не доказана | Подтвердить owner account/recovery; включить branch protection; при необходимости repository transfer |
| Telegram bot | `@sherkozu_bot`, ID `8605808829` | BotFather account не определяется через API | Обычно не требует оплаты | Получатель сначала пишет боту; BotFather `/mybots` → Transfer ownership [11] |
| Bitrix24 | `b24-gzcp0i.bitrix24.ru` | Андрей Шипелов, API user 1, Admin | Не подтверждено | В портале подтвердить commercial owner; выдать admin; rotate webhooks |
| Email/OTP | Отдельного SMTP account нет; Bitrix24 CRM email | Следует ownership Bitrix24 | Следует billing Bitrix24 | Передать Bitrix24 или внедрить owner SMTP/transactional email |
| Text LLM | Cloudflare Workers AI | Тот же подтверждённый Cloudflare account | Cloudflare account | Отдельного OpenAI account нет; `gpt-4o-mini` — request alias |
| Voice transcription | Рабочий provider не подтверждён | Не подтверждено | Не подтверждено | Реализовать owner-controlled `/v1/audio/transcriptions` provider |
| Yandex Maps | API key активен | Account email не определяется ключом | Не подтверждено | Найти key в Yandex Developer cabinet, передать project и billing |
| Object storage | Production S3 не настроен | Нет | Нет | Создать owner bucket; скопировать VDS/CDN media |
| Manus CloudFront assets | Project-scoped path | Manus project resource | В составе project | Скачать, checksum, загрузить в owner bucket, rewrite URLs |
| Google Maps | Production keys empty | Не используется | Нет | Не требуется |
| Gamma / Google Drive | Runtime integration не найдена | Не используется | Нет | Не требуется |
| Stripe / Shopify | Не настроены | Не используется | Нет | Не требуется |
| Monitoring/Sentry/Datadog | Не настроены | Нет | Нет | Выбрать owner-controlled monitoring |

## 7. VDS и домены

VDS IP `89.111.165.77` находится в `RU-CENTER-OS-NETWORK`; это подтверждает network operator, но не customer account или payer. В текущей среде нет VDS SSH key. GitHub Secrets `VDS_HOST`, `VDS_USER`, `VDS_SSH_KEY` — единственный доступный deployment path. Поэтому владельцев записей `authorized_keys` нельзя перечислить без серверного read-only audit. [12]

`sherkozu.ru` зарегистрирован через RU-CENTER, paid-till `2027-04-07T21:31:19Z`; authoritative DNS — Cloudflare. `koza.vip` зарегистрирован через RU-CENTER, expires `2027-04-07T16:36:13Z`; authoritative DNS — RU-CENTER, A/`www` указывает на VDS, DNSSEC не подписан, transfer prohibited. Registrant details redacted. [13] [14]

## 8. Необходимые действия по приоритету

1. **P0 — подтвердить production fingerprint.** На VDS вычислить SHA‑256 current `DATABASE_URL` без вывода URL и сравнить с sealed audit fingerprint. При несовпадении сделать новый production dump.
2. **P0 — создать owner-controlled TiDB.** Назначить `rusventure@gmail.com` Organization Owner, настроить least-privilege SQL user и firewall.
3. **P0 — выполнить rehearsal restore.** Импорт, migration baseline 0066, row/schema checks, auth/core smoke.
4. **P0 — сохранить media.** Backup VDS uploads и перенос project CloudFront assets.
5. **P1 — выполнить 15–30-минутный cutover.** Freeze, final snapshot, import, baseline, secret update, deploy, smoke, rollback window.
6. **P1 — передать VDS/registrar/Telegram/Yandex/Bitrix.** Для неизвестных owner/payer использовать provider cabinets и invoices; не угадывать по runtime credentials.
7. **P1 — удалить OTP из logs** и перевести Bitrix webhook literal в GitHub Secret с rotation.
8. **P2 — добавить monitoring, independent backups и ежеквартальный restore drill.**

## 9. References

[1]: ./docs/managed-tidb-dump-manifest.json "Managed TiDB dump manifest"
[2]: ./docs/managed-tidb-compatibility-report.json "Managed TiDB compatibility report"
[3]: https://docs.pingcap.com/tidbcloud/manage-user-access/ "TiDB Cloud — Manage user access"
[4]: https://docs.pingcap.com/tidbcloud/configure-serverless-firewall-rules-for-public-endpoints/ "TiDB Cloud — Configure firewall rules"
[5]: https://docs.pingcap.com/tidbcloud/secure-connections-to-serverless-clusters/ "TiDB Cloud — Secure connections"
[6]: https://docs.pingcap.com/tidbcloud/serverless-limitations/ "TiDB Cloud Serverless limitations"
[7]: https://docs.pingcap.com/tidbcloud/backup-and-restore/ "TiDB Cloud Dedicated backup and restore"
[8]: https://github.com/drizzle-team/drizzle-orm/blob/0.44.5/drizzle-orm/src/mysql-core/dialect.ts "Drizzle ORM v0.44.5 — MySQL migration algorithm"
[9]: https://docs.pingcap.com/tidbcloud/import-with-mysql-cli-serverless/ "TiDB Cloud — Import with MySQL CLI"
[10]: ./docs/managed-media-origin-inventory.json "Managed media origin inventory"
[11]: https://core.telegram.org/bots/features#transfer-ownership "Telegram — Transfer bot ownership"
[12]: https://rdap.db.ripe.net/ip/89.111.165.77 "RIPE RDAP — VDS network allocation"
[13]: https://whois.tcinet.ru/ "TCI WHOIS — sherkozu.ru"
[14]: https://rdap.nic.vip/domain/koza.vip "Authoritative .vip RDAP — koza.vip"
