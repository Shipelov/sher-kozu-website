# Фильтр дампа mysqldump (MySQL 8 / MariaDB) перед импортом в TiDB (koza-rehearsal).
# Применять: sed -E -f scripts/ops/tidb-compat-filter.sed dump.sql > restore.sql
# Удаляет только директивы, которые TiDB не принимает; CREATE TABLE / INSERT не трогает.
# Список задокументирован в docs/ops/BACKUP.md; при новой несовместимости — дополнить здесь и там.

# GTID: в TiDB нет переменной GTID_PURGED (mysqldump без --set-gtid-purged=OFF)
/^SET @@GLOBAL\.GTID_PURGED=/d
# Binlog-обёртка mysqldump: в TiDB SQL_LOG_BIN бесполезна, убираем вместе с временной переменной
/^SET @MYSQLDUMP_TEMP_LOG_BIN/d
/^SET @@SESSION\.SQL_LOG_BIN/d
# RocksDB bulk-load (MariaDB/Percona): SELECT ... INTO @var + PREPARE/EXECUTE по переменной
/rocksdb/d
/@disable_bulk_load/d
/^\/\*!50717 (PREPARE|EXECUTE|DEALLOCATE PREPARE) s/d
# MariaDB-only исполняемые комментарии и sandbox-строка MariaDB 11
/^\/\*M!/d
/^\/\*!999999/d
# Триггеры, процедуры, функции и события: TiDB их не поддерживает. Блоки идут между
# DELIMITER ;; и DELIMITER ; — удаляем целиком
/^DELIMITER ;;$/,/^DELIMITER ;$/d
