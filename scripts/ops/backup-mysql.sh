#!/usr/bin/env bash
# Ежедневный бэкап production MySQL (база sherkozu на VDS). Запуск из cron и из
# workflow backup-mysql-offsite.yml (по SSH: `bash -s -- run < backup-mysql.sh`).
#
#   backup-mysql.sh run        снять дамп за сегодня (если файл за сегодня уже есть и
#                              проходит проверку — переиспользовать; --force пересоздаёт)
#   backup-mysql.sh --latest   напечатать путь к самому свежему дневному файлу
#   backup-mysql.sh --self-test проверить логику на фикстурах без MySQL
#
# Доступ к MySQL — только через ~/.my.cnf (mode 600), пароль в скрипте не хранится.
# Файлы: $BACKUP_DIR/sherkozu-YYYY-MM-DD.sql.gz (+ .stats.json с COUNT(*) по таблицам),
# копии по воскресеньям — в $BACKUP_DIR/weekly. Хранится 14 дневных и 8 недельных.
# Лог: /var/log/sherkozu-backup.log. См. docs/ops/BACKUP.md.
set -Eeuo pipefail
umask 077

DB_NAME="${BACKUP_DB_NAME:-sherkozu}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/sherkozu}"
LOG_FILE="${BACKUP_LOG_FILE:-/var/log/sherkozu-backup.log}"
KEEP_DAILY="${BACKUP_KEEP_DAILY:-14}"
KEEP_WEEKLY="${BACKUP_KEEP_WEEKLY:-8}"
WEEKLY_DOW="${BACKUP_WEEKLY_DOW:-7}"          # date +%u: 7 = воскресенье
MYSQLDUMP="${MYSQLDUMP:-mysqldump}"
MYSQL="${MYSQL:-mysql}"
DEFAULTS_FILE="${MYSQL_DEFAULTS_FILE:-$HOME/.my.cnf}"
BACKUP_DATE="${BACKUP_DATE:-$(date +%F)}"
DUMP_TIMEOUT="${BACKUP_DUMP_TIMEOUT:-1200}"   # секунд на mysqldump

log() {
  local line
  line="$(date -u +%Y-%m-%dT%H:%M:%SZ) $*"
  printf '%s\n' "$line" >&2
  printf '%s\n' "$line" >> "$LOG_FILE" 2>/dev/null || true
}
die() { log "ОШИБКА: $*"; exit 1; }

# Дамп считается годным, если gzip цел, файл не пуст и заканчивается строкой mysqldump
verify_dump() {
  local file="$1"
  [ -s "$file" ] || { log "файл пуст: $file"; return 1; }
  gzip -t "$file" 2>/dev/null || { log "gzip повреждён: $file"; return 1; }
  gzip -dc "$file" | tail -n 3 | grep -q '^-- Dump completed' || { log "нет строки 'Dump completed' — дамп оборван: $file"; return 1; }
}

# COUNT(*) по каждой таблице → JSON; используется restore-test для сверки
write_stats() {
  local out="$1" query
  query=$($MYSQL --defaults-file="$DEFAULTS_FILE" -N -B -e \
    "SELECT GROUP_CONCAT(CONCAT('SELECT ''', table_name, ''' AS t, COUNT(*) AS n FROM \`', REPLACE(table_name, '\`', '\`\`'), '\`') SEPARATOR ' UNION ALL ') FROM information_schema.tables WHERE table_schema = '$DB_NAME' AND table_type = 'BASE TABLE'")
  [ -n "$query" ] && [ "$query" != "NULL" ] || { log "в базе $DB_NAME нет таблиц"; return 1; }
  $MYSQL --defaults-file="$DEFAULTS_FILE" -N -B -e "$query" "$DB_NAME" | awk -v db="$DB_NAME" -v ts="$(date -u +%Y-%m-%dT%H:%M:%SZ)" '
    BEGIN { printf "{\"database\":\"%s\",\"createdAt\":\"%s\",\"tables\":[", db, ts }
    { gsub(/\\/, "\\\\", $1); gsub(/"/, "\\\"", $1); printf "%s{\"tableName\":\"%s\",\"rowCount\":%d}", (NR > 1 ? "," : ""), $1, $2 }
    END { print "]}" }' > "$out"
}

rotate() {
  local dir="$1" keep="$2" file
  [ -d "$dir" ] || return 0
  # Имена содержат дату, поэтому лексикографический порядок = хронологический
  while IFS= read -r file; do
    [ -n "$file" ] || continue
    log "ротация: удаляю $file"
    rm -f "$file" "${file%.sql.gz}.stats.json"
  done < <(find "$dir" -maxdepth 1 -name "${DB_NAME}-????-??-??.sql.gz" -printf '%f\n' | sort | head -n "-$keep" | sed "s|^|$dir/|")
}

latest_daily() {
  find "$BACKUP_DIR" -maxdepth 1 -name "${DB_NAME}-????-??-??.sql.gz" -printf '%f\n' | sort | tail -n 1
}

run_backup() {
  local force="${1:-}"
  [ -r "$DEFAULTS_FILE" ] || die "нет $DEFAULTS_FILE — доступ к MySQL только через option-файл с mode 600"
  local mode
  mode=$(stat -c %a "$DEFAULTS_FILE" 2>/dev/null || echo "")
  [ "$mode" = "600" ] || [ "$mode" = "400" ] || die "$DEFAULTS_FILE должен иметь права 600 (сейчас $mode)"
  mkdir -p "$BACKUP_DIR/weekly" || die "не могу создать $BACKUP_DIR"
  chmod 700 "$BACKUP_DIR" "$BACKUP_DIR/weekly"
  touch "$LOG_FILE" 2>/dev/null || die "лог $LOG_FILE недоступен для записи"

  # Простая блокировка от параллельного запуска (cron + workflow)
  local lock="$BACKUP_DIR/.lock"
  if ! mkdir "$lock" 2>/dev/null; then
    die "уже выполняется (есть $lock); если это ошибка — удалите каталог"
  fi
  # Путь раскрывается сейчас: при выходе локальной переменной уже нет
  trap "rmdir '$lock' 2>/dev/null || true" EXIT

  local final="$BACKUP_DIR/${DB_NAME}-${BACKUP_DATE}.sql.gz"
  local stats="$BACKUP_DIR/${DB_NAME}-${BACKUP_DATE}.stats.json"
  if [ -z "$force" ] && [ -f "$final" ] && verify_dump "$final"; then
    log "дамп за $BACKUP_DATE уже есть и проходит проверку: $final — пропускаю"
  else
    local tmp="$final.tmp.$$"
    log "старт mysqldump $DB_NAME → $final"
    local started
    started=$(date +%s)
    if ! timeout "$DUMP_TIMEOUT" "$MYSQLDUMP" --defaults-file="$DEFAULTS_FILE" \
        --single-transaction --routines --triggers --events --hex-blob \
        --set-gtid-purged=OFF --no-tablespaces --default-character-set=utf8mb4 --quick \
        "$DB_NAME" | gzip -9 > "$tmp"; then
      rm -f "$tmp"
      die "mysqldump завершился с ошибкой"
    fi
    if ! verify_dump "$tmp"; then
      rm -f "$tmp"
      die "проверка дампа не пройдена, файл удалён"
    fi
    mv -f "$tmp" "$final"
    chmod 600 "$final"
    write_stats "$stats" || die "не удалось собрать COUNT(*) по таблицам"
    chmod 600 "$stats"
    log "готово за $(( $(date +%s) - started )) с: $final ($(stat -c %s "$final") байт), таблиц в stats: $(grep -o '"tableName"' "$stats" | wc -l)"
  fi

  if [ "$(date -d "$BACKUP_DATE" +%u)" = "$WEEKLY_DOW" ]; then
    local weekly="$BACKUP_DIR/weekly/${DB_NAME}-${BACKUP_DATE}.sql.gz"
    if [ ! -f "$weekly" ]; then
      cp -p "$final" "$weekly"
      [ -f "$stats" ] && cp -p "$stats" "${weekly%.sql.gz}.stats.json"
      log "недельная копия: $weekly"
    fi
  fi

  rotate "$BACKUP_DIR" "$KEEP_DAILY"
  rotate "$BACKUP_DIR/weekly" "$KEEP_WEEKLY"
  log "хранится дневных: $(find "$BACKUP_DIR" -maxdepth 1 -name "${DB_NAME}-????-??-??.sql.gz" | wc -l), недельных: $(find "$BACKUP_DIR/weekly" -maxdepth 1 -name "${DB_NAME}-????-??-??.sql.gz" | wc -l)"
}

self_test() {
  local tmp failures=0
  tmp=$(mktemp -d)
  # Заглушки вместо mysqldump/mysql: печатают дамп с завершающей строкой и TSV со счётчиками
  cat > "$tmp/fake-mysqldump" <<'EOF'
#!/usr/bin/env bash
printf -- '-- MySQL dump 10.13  Distrib 8.0.46\nCREATE TABLE `users` (`id` int);\nINSERT INTO `users` VALUES (1),(2);\nCREATE TABLE `animals` (`id` int);\n'
if [ "${FAKE_TRUNCATE:-}" = "1" ]; then exit 0; fi
printf -- '\n-- Dump completed on 2026-09-08 03:00:00\n'
EOF
  cat > "$tmp/fake-mysql" <<'EOF'
#!/usr/bin/env bash
# Первый вызов — генерация запроса, второй — данные
if printf '%s' "$*" | grep -q information_schema; then
  printf "SELECT 'users' AS t, COUNT(*) AS n FROM \`users\` UNION ALL SELECT 'animals' AS t, COUNT(*) AS n FROM \`animals\`\n"
else
  printf 'users\t2\nanimals\t3\n'
fi
EOF
  chmod +x "$tmp/fake-mysqldump" "$tmp/fake-mysql"
  printf '[client]\nuser=fixture\npassword=fixture\n' > "$tmp/my.cnf"
  chmod 600 "$tmp/my.cnf"

  check() {
    if eval "$2"; then echo "ok   $1"; else echo "FAIL $1"; failures=$((failures + 1)); fi
  }

  export BACKUP_DIR="$tmp/backups" BACKUP_LOG_FILE="$tmp/backup.log" MYSQL_DEFAULTS_FILE="$tmp/my.cnf"
  export MYSQLDUMP="$tmp/fake-mysqldump" MYSQL="$tmp/fake-mysql" BACKUP_DB_NAME="sherkozu"
  # 20 старых дневных и 10 недельных файлов для проверки ротации
  mkdir -p "$BACKUP_DIR/weekly"
  local i
  for i in $(seq 40 59); do
    printf 'x' | gzip > "$BACKUP_DIR/sherkozu-2026-06-$(printf '%02d' $((i - 30))).sql.gz"
  done
  for i in $(seq 1 10); do
    printf 'x' | gzip > "$BACKUP_DIR/weekly/sherkozu-2026-05-$(printf '%02d' "$i").sql.gz"
  done

  # 2026-09-06 — воскресенье → должна появиться недельная копия
  BACKUP_DATE=2026-09-06 bash "$0" run >/dev/null 2>&1
  check "дневной файл создан" "[ -s '$BACKUP_DIR/sherkozu-2026-09-06.sql.gz' ]"
  check "файл заканчивается Dump completed" "gzip -dc '$BACKUP_DIR/sherkozu-2026-09-06.sql.gz' | tail -n 1 | grep -q '^-- Dump completed'"
  check "stats.json с двумя таблицами" "grep -q '\"tableName\":\"users\",\"rowCount\":2' '$BACKUP_DIR/sherkozu-2026-09-06.stats.json' && grep -q '\"animals\",\"rowCount\":3' '$BACKUP_DIR/sherkozu-2026-09-06.stats.json'"
  check "недельная копия по воскресенью" "[ -f '$BACKUP_DIR/weekly/sherkozu-2026-09-06.sql.gz' ]"
  check "дневных хранится 14" "[ \$(find '$BACKUP_DIR' -maxdepth 1 -name 'sherkozu-????-??-??.sql.gz' | wc -l) -eq 14 ]"
  check "недельных хранится 8" "[ \$(find '$BACKUP_DIR/weekly' -maxdepth 1 -name 'sherkozu-????-??-??.sql.gz' | wc -l) -eq 8 ]"
  check "самые старые удалены, свежий остался" "[ ! -f '$BACKUP_DIR/sherkozu-2026-06-10.sql.gz' ] && [ -f '$BACKUP_DIR/sherkozu-2026-09-06.sql.gz' ]"
  check "права 600 на дампе" "[ \$(stat -c %a '$BACKUP_DIR/sherkozu-2026-09-06.sql.gz') = 600 ]"
  check "--latest печатает свежий файл" "[ \$(bash '$0' --latest) = '$BACKUP_DIR/sherkozu-2026-09-06.sql.gz' ]"
  check "лог пишется" "grep -q 'готово за' '$BACKUP_LOG_FILE'"

  # Повторный запуск в тот же день переиспользует файл
  local before after
  before=$(stat -c %Y "$BACKUP_DIR/sherkozu-2026-09-06.sql.gz")
  sleep 1
  BACKUP_DATE=2026-09-06 bash "$0" run >/dev/null 2>&1
  after=$(stat -c %Y "$BACKUP_DIR/sherkozu-2026-09-06.sql.gz")
  check "повторный запуск не пересоздаёт файл" "[ '$before' = '$after' ] && grep -q 'пропускаю' '$BACKUP_LOG_FILE'"

  # Оборванный дамп отклоняется, файл не появляется
  if FAKE_TRUNCATE=1 BACKUP_DATE=2026-09-07 bash "$0" run >/dev/null 2>&1; then
    check "оборванный дамп отклонён" "false"
  else
    check "оборванный дамп отклонён" "[ ! -f '$BACKUP_DIR/sherkozu-2026-09-07.sql.gz' ] && grep -q 'оборван' '$BACKUP_LOG_FILE'"
  fi

  # Неверные права на my.cnf — отказ
  chmod 644 "$tmp/my.cnf"
  if [ "$(stat -c %a "$tmp/my.cnf")" != "644" ]; then
    echo "skip my.cnf с правами 644 отклонён (ФС не хранит права, например Git Bash на Windows)"
  elif BACKUP_DATE=2026-09-08 bash "$0" run >/dev/null 2>&1; then
    check "my.cnf с правами 644 отклонён" "false"
  else
    check "my.cnf с правами 644 отклонён" "true"
  fi

  rm -rf "$tmp"
  if [ "$failures" -eq 0 ]; then
    echo "backup-mysql self-test: ok"
  else
    echo "backup-mysql self-test: $failures ошибок" >&2
    return 1
  fi
}

case "${1:-run}" in
  run) run_backup "${2:-}" ;;
  --force) run_backup force ;;
  --latest)
    latest=$(latest_daily)
    [ -n "$latest" ] || die "в $BACKUP_DIR нет дневных дампов"
    printf '%s\n' "$BACKUP_DIR/$latest"
    ;;
  --self-test) self_test ;;
  *) die "неизвестная команда: $1 (run | --force | --latest | --self-test)" ;;
esac
