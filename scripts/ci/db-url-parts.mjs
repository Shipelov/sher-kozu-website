#!/usr/bin/env node
/**
 * Разбор mysql://user:pass@host:port/db?… (а также mysql2://) через new URL()
 * с decodeURIComponent для user/password. Query (?ssl=…) игнорируется.
 *
 * Для GitHub Actions:
 *   node scripts/ci/db-url-parts.mjs --env SOURCE_DATABASE_URL --prefix SOURCE_DB_ \
 *     --password-file "$RUNNER_TEMP/source.pw" --mysql-cnf "$RUNNER_TEMP/source.cnf" --github-env
 * пишет <prefix>HOST/PORT/USER/NAME в $GITHUB_ENV, пароль — в файл mode 600
 * (и в option-файл mysql, если задан --mysql-cnf), маскирует пароль и user в логе.
 * В stdout попадают только host, port и имя базы.
 *
 * node scripts/ci/db-url-parts.mjs --self-test — фикстуры без сети.
 */
import { appendFileSync, chmodSync, writeFileSync } from "node:fs";
import path from "node:path";

const SCHEMES = new Set(["mysql:", "mysql2:", "mariadb:"]);
const DEFAULT_PORT = 4000;

export function parseDbUrl(raw) {
  if (typeof raw !== "string") throw new Error("URL базы не задан");
  let value = raw.trim();
  let strippedQuotes = false;
  if (value.length >= 2 && ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'")))) {
    value = value.slice(1, -1).trim();
    strippedQuotes = true;
  }
  if (!value) throw new Error("URL базы пуст");
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error("URL базы не разбирается (ожидается mysql://user:pass@host:port/db)");
  }
  if (!SCHEMES.has(url.protocol)) {
    throw new Error(`Неподдерживаемая схема ${url.protocol || "(нет)"}; ожидается mysql:// или mysql2://`);
  }
  if (!url.hostname) throw new Error("В URL нет host");
  const user = decodeURIComponent(url.username);
  const password = decodeURIComponent(url.password);
  if (!user) throw new Error("В URL нет user");
  if (/[\r\n]/.test(password)) throw new Error("Пароль содержит перевод строки — такой пароль нельзя передать клиентам");
  let database = decodeURIComponent(url.pathname.replace(/^\/+/, ""));
  if (!database) {
    // Некоторые провайдеры кладут базу в query
    database = url.searchParams.get("database") ?? url.searchParams.get("db") ?? "";
  }
  if (!database) throw new Error("В URL нет имени базы");
  const port = url.port ? Number(url.port) : DEFAULT_PORT;
  if (!Number.isInteger(port) || port <= 0) throw new Error("Порт в URL не число");
  return { scheme: url.protocol.replace(/:$/, ""), host: url.hostname, port, user, password, database, strippedQuotes };
}

/** Option-файл mysql/mysqldump: TLS обязателен, значения экранированы для формата my.cnf */
export function mysqlOptionFile(parts) {
  const esc = (v) => String(v).replaceAll("\\", "\\\\").replaceAll('"', '\\"');
  return [
    "[client]",
    `host=${parts.host}`,
    `port=${parts.port}`,
    `user="${esc(parts.user)}"`,
    `password="${esc(parts.password)}"`,
    "ssl-mode=REQUIRED",
    "default-character-set=utf8mb4",
    "",
  ].join("\n");
}

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const key = argv[i];
    if (!key.startsWith("--")) continue;
    const next = argv[i + 1];
    if (next === undefined || next.startsWith("--")) {
      args[key.slice(2)] = true;
    } else {
      args[key.slice(2)] = next;
      i += 1;
    }
  }
  return args;
}

function writeSecretFile(file, content) {
  writeFileSync(file, content, { mode: 0o600 });
  chmodSync(file, 0o600);
}

function selfTest() {
  const cases = [
    {
      name: "стандартный TiDB Cloud URL с query",
      url: 'mysql://2abc.root:p%40ss%3Aw%2Frd%25x@gateway01.example.invalid:4000/prod?ssl={"rejectUnauthorized":true}',
      expect: { scheme: "mysql", host: "gateway01.example.invalid", port: 4000, user: "2abc.root", password: "p@ss:w/rd%x", database: "prod" },
    },
    {
      name: "схема mysql2, порт по умолчанию",
      url: "mysql2://user:secret@db.example.invalid/test",
      expect: { scheme: "mysql2", host: "db.example.invalid", port: 4000, user: "user", password: "secret", database: "test" },
    },
    {
      name: "пароль с сырым @ и закодированными \\ и кавычкой",
      url: "mysql://user:pa%5Css%22q@ss@db.example.invalid:3306/koza",
      expect: { host: "db.example.invalid", port: 3306, user: "user", password: 'pa\\ss"q@ss', database: "koza" },
    },
    {
      name: "URL в кавычках, база в query",
      url: '"mysql://user:pw@db.example.invalid:4000/?database=koza&ssl=true"',
      expect: { user: "user", password: "pw", database: "koza", strippedQuotes: true },
    },
    {
      name: "пустой пароль",
      url: "mysql://user@db.example.invalid:4000/db",
      expect: { user: "user", password: "", database: "db" },
    },
  ];
  const rejects = [
    { name: "без схемы", url: "user:pass@host/db" },
    { name: "чужая схема", url: "postgres://user:pass@host/db" },
    { name: "без базы", url: "mysql://user:pass@host:4000" },
    { name: "без user", url: "mysql://host:4000/db" },
    { name: "перевод строки в пароле", url: "mysql://user:pa%0Ass@host:4000/db" },
  ];
  let failures = 0;
  for (const item of cases) {
    try {
      const parts = parseDbUrl(item.url);
      const bad = Object.entries(item.expect).filter(([k, v]) => parts[k] !== v);
      if (bad.length) {
        failures += 1;
        console.log(`FAIL ${item.name}: ${bad.map(([k, v]) => `${k} ожидалось [${v}] получено [${parts[k]}]`).join("; ")}`);
      } else console.log(`ok   ${item.name}`);
    } catch (err) {
      failures += 1;
      console.log(`FAIL ${item.name}: ${err.message}`);
    }
  }
  for (const item of rejects) {
    try {
      parseDbUrl(item.url);
      failures += 1;
      console.log(`FAIL отклонение: ${item.name} — принят`);
    } catch {
      console.log(`ok   отклонение: ${item.name}`);
    }
  }
  const cnf = mysqlOptionFile(parseDbUrl("mysql://user:pa%5Css%22q@db.example.invalid/koza"));
  if (!cnf.includes('password="pa\\\\ss\\"q"') || !cnf.includes("ssl-mode=REQUIRED")) {
    failures += 1;
    console.log("FAIL option-файл: экранирование или TLS");
  } else console.log("ok   option-файл: экранирование и TLS");
  if (failures) throw new Error(`db-url-parts self-test: ${failures} ошибок`);
  console.log(JSON.stringify({ selfTest: "ok", cases: cases.length + rejects.length + 1 }));
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args["self-test"]) return selfTest();
  const envName = args.env ?? "DATABASE_URL";
  const prefix = args.prefix ?? "DB_";
  const parts = parseDbUrl(process.env[envName]);
  if (parts.strippedQuotes) console.warn(`[db-url-parts] ${envName} был в кавычках — кавычки отброшены`);

  if (args["password-file"]) writeSecretFile(path.resolve(args["password-file"]), parts.password);
  if (args["mysql-cnf"]) writeSecretFile(path.resolve(args["mysql-cnf"]), mysqlOptionFile(parts));

  if (args["github-env"]) {
    const githubEnv = process.env.GITHUB_ENV;
    if (!githubEnv) throw new Error("--github-env задан, но переменной GITHUB_ENV нет");
    // Маскируем секретные части до любого вывода; GitHub читает команды из stdout
    if (parts.password) console.log(`::add-mask::${parts.password}`);
    console.log(`::add-mask::${parts.user}`);
    appendFileSync(
      githubEnv,
      [`${prefix}HOST=${parts.host}`, `${prefix}PORT=${parts.port}`, `${prefix}USER=${parts.user}`, `${prefix}NAME=${parts.database}`, ""].join("\n"),
    );
  }
  console.log(
    `[db-url-parts] ${envName}: scheme=${parts.scheme} host=${parts.host} port=${parts.port} db=${parts.database} user=<${parts.user.length} chars> password=<${parts.password.length} chars>`,
  );
}

const invokedDirectly =
  process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));
if (invokedDirectly) {
  try {
    main();
  } catch (error) {
    console.error(`[db-url-parts] ${error?.message ?? error}`);
    process.exit(1);
  }
}
