#!/usr/bin/env bash
# Разбор mysql://user:pass@host:port/db?query в DB_HOST DB_PORT DB_USER DB_PASSWORD DB_NAME
# без вывода значений. Подключать через `source`, затем parse_database_url "$URL".
# write_mysql_defaults_file PATH пишет option-файл для mysql/mysqldump (mode 600):
# пароль не попадает ни в аргументы процесса, ни в лог.
# `bash scripts/ci/parse-database-url.sh --self-test` гоняет фикстуры.
set -Eeuo pipefail

# %XX → байт; обратный слэш экранируется до подстановки, чтобы %b его не трактовал
url_decode() {
  local s="$1"
  s="${s//\\/\\\\}"
  s="${s//%/\\x}"
  printf '%b' "$s"
}

parse_database_url() {
  local url="$1"
  local rest="${url#*://}"
  if [ "$rest" = "$url" ]; then
    echo "parse_database_url: в URL нет схемы (mysql://…)" >&2
    return 1
  fi
  local authority="${rest%%/*}"
  local pathq=""
  if [ "$authority" != "$rest" ]; then
    pathq="${rest#*/}"
  fi
  local userinfo="" hostport="$authority"
  if [[ "$authority" == *@* ]]; then
    userinfo="${authority%@*}"
    hostport="${authority##*@}"
  fi
  local user="${userinfo%%:*}" pass=""
  if [[ "$userinfo" == *:* ]]; then
    pass="${userinfo#*:}"
  fi
  local host="${hostport%%:*}" port="4000"
  if [[ "$hostport" == *:* ]]; then
    port="${hostport##*:}"
  fi
  local db="${pathq%%\?*}"

  DB_HOST=$(url_decode "$host")
  DB_PORT="$port"
  DB_USER=$(url_decode "$user")
  DB_PASSWORD=$(url_decode "$pass")
  DB_NAME=$(url_decode "$db")
  export DB_HOST DB_PORT DB_USER DB_PASSWORD DB_NAME

  if [ -z "$DB_HOST" ] || [ -z "$DB_USER" ] || [ -z "$DB_NAME" ]; then
    echo "parse_database_url: host, user или имя базы пусты" >&2
    return 1
  fi
  if ! [[ "$DB_PORT" =~ ^[0-9]+$ ]]; then
    echo "parse_database_url: порт не число" >&2
    return 1
  fi
}

# Option-файл mysql: TLS обязателен, значения в кавычках с экранированием \ и "
write_mysql_defaults_file() {
  local path="$1"
  local esc_pass="${DB_PASSWORD//\\/\\\\}"
  esc_pass="${esc_pass//\"/\\\"}"
  local esc_user="${DB_USER//\\/\\\\}"
  esc_user="${esc_user//\"/\\\"}"
  (
    umask 077
    printf '[client]\nhost=%s\nport=%s\nuser="%s"\npassword="%s"\nssl-mode=REQUIRED\ndefault-character-set=utf8mb4\n' \
      "$DB_HOST" "$DB_PORT" "$esc_user" "$esc_pass" > "$path"
  )
  chmod 600 "$path"
}

self_test() {
  local failures=0
  check() {
    local label="$1" expected="$2" actual="$3"
    if [ "$expected" = "$actual" ]; then
      echo "ok   $label"
    else
      echo "FAIL $label: ожидалось [$expected], получено [$actual]"
      failures=$((failures + 1))
    fi
  }

  # Все значения ниже — вымышленные фикстуры
  parse_database_url 'mysql://2abc.root:p%40ss%3Aw%2Frd%25x@gateway01.example.invalid:4000/test?ssl={"rejectUnauthorized":true}'
  check "user с точкой" "2abc.root" "$DB_USER"
  check "пароль с @ : / %" 'p@ss:w/rd%x' "$DB_PASSWORD"
  check "host" "gateway01.example.invalid" "$DB_HOST"
  check "port" "4000" "$DB_PORT"
  check "db без query" "test" "$DB_NAME"

  parse_database_url 'mysql://user:pa%5Css%22q@db.example.invalid/koza'
  check "порт по умолчанию" "4000" "$DB_PORT"
  check "пароль с \\ и кавычкой" 'pa\ss"q' "$DB_PASSWORD"
  check "db" "koza" "$DB_NAME"

  parse_database_url 'mysql://user@db.example.invalid:3306/db'
  check "пустой пароль" "" "$DB_PASSWORD"
  check "нестандартный порт" "3306" "$DB_PORT"

  if parse_database_url 'user:pass@host/db' 2>/dev/null; then
    check "URL без схемы отклоняется" "reject" "accept"
  else
    check "URL без схемы отклоняется" "reject" "reject"
  fi
  if parse_database_url 'mysql://user:pass@host:4000' 2>/dev/null; then
    check "URL без базы отклоняется" "reject" "accept"
  else
    check "URL без базы отклоняется" "reject" "reject"
  fi

  local tmp
  tmp=$(mktemp)
  parse_database_url 'mysql://user:pa%5Css%22q@db.example.invalid/koza'
  write_mysql_defaults_file "$tmp"
  check "option-файл: TLS обязателен" "1" "$(grep -c '^ssl-mode=REQUIRED$' "$tmp")"
  check "option-файл: пароль экранирован" '1' "$(grep -c '^password="pa\\\\ss\\"q"$' "$tmp")"
  check "option-файл: user" '1' "$(grep -c '^user="user"$' "$tmp")"
  rm -f "$tmp"

  if [ "$failures" -eq 0 ]; then
    echo "parse-database-url self-test: ok"
  else
    echo "parse-database-url self-test: $failures ошибок" >&2
    return 1
  fi
}

if [ "${BASH_SOURCE[0]}" = "$0" ] && [ "${1:-}" = "--self-test" ]; then
  self_test
fi
