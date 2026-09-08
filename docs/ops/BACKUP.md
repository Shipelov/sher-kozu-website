# Бэкап production MySQL (VDS) и offsite-копия

**Факт (8 сентября 2026):** production-база — MySQL 8.0 локально на VDS (`localhost:3306`, база `sherkozu`),
не managed TiDB. `secrets.DATABASE_URL` — это адрес, который `deploy.yml` записывает в `.env` на VDS.
TiDB Cloud используется только для тестов CI (`TEST_DATABASE_URL`) и как кластер `koza-rehearsal`
(`REHEARSAL_DATABASE_URL`, база `test`) для проверки восстановления.

## Схема

| Слой | Что | Где |
|---|---|---|
| Локальный дамп | `scripts/ops/backup-mysql.sh` из cron на VDS: `mysqldump --single-transaction --routines --triggers --events --hex-blob --set-gtid-purged=OFF --no-tablespaces` → gzip; проверка «файл не пуст, gzip цел, заканчивается `-- Dump completed`»; `stats.json` с `COUNT(*)` по таблицам (вторичен: при его сбое дамп сохраняется, в лог пишется `ПРЕДУПРЕЖДЕНИЕ`, код выхода 0) | `/var/backups/sherkozu/sherkozu-YYYY-MM-DD.sql.gz`, 14 дневных; `weekly/` — 8 недельных (копия по воскресеньям); лог `/var/log/sherkozu-backup.log` |
| Offsite-копия | `.github/workflows/backup-mysql-offsite.yml` ежедневно в 03:30 UTC и вручную: по SSH под `VDS_USER` запускает установленную копию `/opt/sherkozu/backup-mysql.sh` от пользователя `deploy` (если файл за сегодня уже есть и проходит проверку — переиспользует), забирает `.sql.gz` и `stats.json` через `scp`, проверяет дамп на раннере, шифрует gpg AES-256 паролем `BACKUP_PASSPHRASE` | artifact `mysql-backup-encrypted-<run_id>`, 90 дней: `*.sql.gz.gpg`, sha256 encrypted и plaintext, `stats.json`, `dump-verification.json` |
| Restore-test | тот же workflow: sed-фильтр совместимости → DROP всех таблиц в `test` → `mysql < restore.sql` → `restore-check.mjs`: число таблиц и `COUNT(*)` по 10 крупнейшим против `stats.json` с допуском 1 %; если `stats.json` на VDS не собрался — только число таблиц (`statsAvailable: false` в отчёте) | artifact `restore-test-results-<run_id>`, 30 дней |

Секреты workflow: `VDS_HOST`, `VDS_USER`, `VDS_SSH_KEY` (уже есть, те же, что у deploy), `REHEARSAL_DATABASE_URL`
(есть), **`BACKUP_PASSPHRASE` — новый, завести владельцу** (длинная случайная строка, хранить в менеджере паролей;
без неё артефакты не расшифровать).

## Под каким пользователем что работает

| Что | Пользователь | Примечание |
|---|---|---|
| cron и локальный дамп | `deploy` | `~/.my.cnf` (600), `/var/backups/sherkozu` и `/var/log/sherkozu-backup.log` принадлежат `deploy`; скрипт установлен в `/opt/sherkozu/backup-mysql.sh` |
| SSH-доступ CI (`VDS_USER`) | `root` | те же секреты `VDS_HOST`/`VDS_USER`/`VDS_SSH_KEY`, что у deploy-workflow |
| Запуск скрипта из workflow | `deploy` через `sudo -u deploy -H /opt/sherkozu/backup-mysql.sh …` | если `VDS_USER` совпадает с `BACKUP_RUN_AS` (`deploy`), sudo не нужен; имя пользователя — env `BACKUP_RUN_AS` на уровне job |
| `scp` дампа и `stats.json` в CI | `root` (ssh-пользователь) | root читает файлы `deploy` без изменений прав |
| Файлы в `/var/backups/sherkozu` | всегда `deploy`, права 600 | и cron, и workflow пишут от `deploy`; `/root/.my.cnf` не нужен и не должен существовать |
| Рабочий каталог | скрипт сам делает `cd /`, workflow — `cd /tmp` перед `sudo` | при `sudo -u deploy` из `/root` `find` в ротации падал с «Failed to restore initial working directory: /root: Permission denied» |

Если ssh-пользователь не `root` и не `deploy`, ему нужен `sudo -u deploy` без пароля: `echo '<user> ALL=(deploy) NOPASSWD: /opt/sherkozu/backup-mysql.sh' | sudo tee /etc/sudoers.d/sherkozu-backup`.

## Установка на VDS (делает владелец, один раз)

```bash
# 1. Пользователь MySQL только для бэкапа (или использовать root — тогда пропустить)
sudo mysql -e "CREATE USER 'backup'@'localhost' IDENTIFIED BY '<пароль>'; \
  GRANT SELECT, SHOW VIEW, TRIGGER, EVENT, LOCK TABLES, PROCESS ON *.* TO 'backup'@'localhost'; FLUSH PRIVILEGES;"

# 2. ~/.my.cnf у пользователя deploy (не у root: workflow запускает скрипт через sudo -u deploy)
printf '[client]\nuser=backup\npassword=<пароль>\n' > ~/.my.cnf && chmod 600 ~/.my.cnf

# 3. Каталог и лог
sudo mkdir -p /var/backups/sherkozu && sudo chown "$USER:$USER" /var/backups/sherkozu && chmod 700 /var/backups/sherkozu
sudo touch /var/log/sherkozu-backup.log && sudo chown "$USER:$USER" /var/log/sherkozu-backup.log

# 4. Скрипт (rsync deploy его не копирует); путь совпадает с BACKUP_SCRIPT_PATH в workflow
sudo mkdir -p /opt/sherkozu && sudo cp /var/www/sherkozu/current/scripts/ops/backup-mysql.sh /opt/sherkozu/ 2>/dev/null \
  || curl -fsSL https://raw.githubusercontent.com/Shipelov/sher-kozu-website/main/scripts/ops/backup-mysql.sh | sudo tee /opt/sherkozu/backup-mysql.sh >/dev/null
sudo chmod 755 /opt/sherkozu/backup-mysql.sh

# 5. Первый запуск руками и проверка
/opt/sherkozu/backup-mysql.sh run && /opt/sherkozu/backup-mysql.sh --latest && tail -5 /var/log/sherkozu-backup.log

# 6. Cron: ежедневно в 03:00 UTC (workflow приходит в 03:30 и переиспользует файл)
( crontab -l 2>/dev/null; echo '0 3 * * * /opt/sherkozu/backup-mysql.sh run >> /var/log/sherkozu-backup.log 2>&1' ) | crontab -
```

`--routines`/`--events` требуют для non-root пользователя MySQL 8 прав `SHOW_ROUTINE`/`EVENT`; если
`mysqldump` жалуется на права — проще дать `backup` глобальный `SELECT` (уже в списке) или использовать root.

## Как проверить, что бэкап есть

- На VDS: `ls -la /var/backups/sherkozu /var/backups/sherkozu/weekly` и `tail -20 /var/log/sherkozu-backup.log`
  — свежая строка `готово за … с` или `уже есть и проходит проверку`, ротация без ошибок.
- Offsite: GitHub → Actions → «MySQL backup offsite and restore test» — зелёный запуск за последние сутки,
  артефакт `mysql-backup-encrypted-<run_id>`. В `restore-test-results-<run_id>/restore-check.json` — `"ok": true`,
  `tableCount.target` = 96 (или текущее число), `largestTables[*].ok` = true.
- В логе на VDS строка `ПРЕДУПРЕЖДЕНИЕ: не удалось собрать COUNT(*)` означает, что дамп есть, а статистики нет: restore-test пройдёт только по числу таблиц. Причина обычно в правах MySQL-пользователя на `information_schema`/таблицы.
- Красный запуск = нет свежей проверенной копии: смотреть лог шага (`Run backup on VDS`, `Verify dump`,
  `Import dump`, `Check restored data`).

## Как восстановить вручную на новый сервер

```bash
# 1. Взять копию: с VDS (/var/backups/sherkozu/…) или скачать артефакт mysql-backup-encrypted-<run_id>
sha256sum -c sherkozu-2026-09-08.sql.gz.gpg.sha256
gpg --decrypt sherkozu-2026-09-08.sql.gz.gpg > sherkozu-2026-09-08.sql.gz   # спросит BACKUP_PASSPHRASE
sha256sum -c sherkozu-2026-09-08.sql.gz.plaintext.sha256
gzip -dc sherkozu-2026-09-08.sql.gz | tail -n 3      # должна быть строка "-- Dump completed"

# 2. Пустой MySQL 8 на новом сервере
sudo mysql -e "CREATE DATABASE sherkozu CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci; \
  CREATE USER 'sherkozu'@'localhost' IDENTIFIED BY '<пароль>'; GRANT ALL ON sherkozu.* TO 'sherkozu'@'localhost';"

# 3. Импорт (в MySQL — без фильтра; триггеры/процедуры/GTID-строки совместимы)
gzip -dc sherkozu-2026-09-08.sql.gz | mysql -u sherkozu -p sherkozu

# 4. Проверка
mysql -u sherkozu -p -e "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='sherkozu' AND table_type='BASE TABLE'; SELECT COUNT(*) FROM sherkozu.users;"
# сравнить с stats.json того же дня

# 5. Прописать DATABASE_URL=mysql://sherkozu:<пароль>@localhost:3306/sherkozu в secrets и задеплоить
```

Восстановление в TiDB (например, в `koza-rehearsal`) — только через фильтр: `sed -E -f scripts/ops/tidb-compat-filter.sed`,
см. ниже. Uploads (`/var/www/sherkozu/uploads`) в этот бэкап не входят — их копирует VDS-аудит Manus
(`one-time-migration-rehearsal.yml`) или отдельный rsync.

## Как поменять пароль шифрования

1. Сгенерировать новый: `openssl rand -base64 48`.
2. Обновить secret `BACKUP_PASSPHRASE` в GitHub (Settings → Secrets and variables → Actions).
3. Запустить workflow вручную — первый артефакт с новым паролем.
4. Старые артефакты (до 90 дней) остаются под старым паролем — сохранить его в менеджере паролей
   до истечения их retention или перешифровать вручную: `gpg --decrypt old.gpg | gpg --symmetric --cipher-algo AES256 -o new.gpg`.

## Совместимость дампа MySQL 8 с TiDB (restore-test)

`scripts/ops/tidb-compat-filter.sed` удаляет только директивы, которые TiDB не принимает:

| Что | Почему |
|---|---|
| `SET @@GLOBAL.GTID_PURGED=…` | в TiDB нет GTID (mysqldump на VDS и так идёт с `--set-gtid-purged=OFF`) |
| `SET @MYSQLDUMP_TEMP_LOG_BIN…`, `SET @@SESSION.SQL_LOG_BIN…` | binlog-обёртка, в TiDB бесполезна |
| строки с `rocksdb`, `@disable_bulk_load`, `/*!50717 PREPARE/EXECUTE/DEALLOCATE PREPARE s` | RocksDB bulk-load (MariaDB/Percona): `SELECT … INTO @var` + prepared statement по переменной |
| `/*M!…*/`, `/*!999999…` | MariaDB-only исполняемые комментарии и sandbox-строка |
| блоки `DELIMITER ;;` … `DELIMITER ;` | триггеры, процедуры, функции, события — TiDB их не поддерживает |

`LOCK TABLES`/`UNLOCK TABLES` и `/*!40000 ALTER TABLE … DISABLE KEYS */` TiDB разбирает и игнорирует,
`utf8mb4_0900_ai_ci` поддерживается с TiDB 7.4. При новой несовместимости при импорте: добавить правило
в `.sed`, строку в эту таблицу и кейс в `server/backupMysqlOffsite.test.ts`.

## История

Сценарий «дамп managed TiDB с раннера» (`owner-dump-and-rehearsal.yml`, PR #12–#15) удалён 8 сентября 2026:
его предпосылка была неверна — production живёт в MySQL на VDS. Workflow Manus `one-time-migration-rehearsal.yml`
оставлен только для read-only аудита VDS и CloudFront-ассетов; шаги импорта dump'а из него убраны.
