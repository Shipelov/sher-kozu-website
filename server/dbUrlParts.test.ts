import { describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { mysqlOptionFile, parseDbUrl } from "../scripts/ci/db-url-parts.mjs";

const root = path.resolve(import.meta.dirname, "..");

describe("db-url-parts: parseDbUrl", () => {
  it("разбирает стандартный URL TiDB Cloud с query ssl", () => {
    const parts = parseDbUrl('mysql://2abc.root:p%40ss%3Aw%2Frd%25x@gateway01.example.invalid:4000/prod?ssl={"rejectUnauthorized":true}');
    expect(parts).toMatchObject({
      scheme: "mysql",
      host: "gateway01.example.invalid",
      port: 4000,
      user: "2abc.root",
      password: "p@ss:w/rd%x",
      database: "prod",
      strippedQuotes: false,
    });
  });

  it("принимает схему mysql2 и порт по умолчанию 4000", () => {
    const parts = parseDbUrl("mysql2://user:secret@db.example.invalid/test");
    expect(parts).toMatchObject({ scheme: "mysql2", host: "db.example.invalid", port: 4000, database: "test" });
  });

  it("пароль с сырым @ и закодированными \\ и кавычкой", () => {
    const parts = parseDbUrl("mysql://user:pa%5Css%22q@ss@db.example.invalid:3306/koza");
    expect(parts.password).toBe('pa\\ss"q@ss');
    expect(parts.port).toBe(3306);
    expect(parts.database).toBe("koza");
  });

  it("снимает кавычки вокруг URL и берёт базу из query, если пути нет", () => {
    const parts = parseDbUrl('"mysql://user:pw@db.example.invalid:4000/?database=koza&ssl=true"');
    expect(parts).toMatchObject({ database: "koza", strippedQuotes: true, user: "user", password: "pw" });
  });

  it("допускает пустой пароль и обрезает пробелы", () => {
    const parts = parseDbUrl("  mysql://user@db.example.invalid:4000/db \n");
    expect(parts.password).toBe("");
    expect(parts.host).toBe("db.example.invalid");
  });

  it("отклоняет URL без схемы, с чужой схемой, без базы, без user и с переводом строки в пароле", () => {
    expect(() => parseDbUrl("user:pass@host/db")).toThrow(/не разбирается|схема/i);
    expect(() => parseDbUrl("postgres://user:pass@host/db")).toThrow(/схема/);
    expect(() => parseDbUrl("mysql://user:pass@host:4000")).toThrow(/имени базы/);
    expect(() => parseDbUrl("mysql://host:4000/db")).toThrow(/user/);
    expect(() => parseDbUrl("mysql://user:pa%0Ass@host:4000/db")).toThrow(/перевод строки/);
    expect(() => parseDbUrl(undefined)).toThrow(/не задан/);
  });

  it("option-файл mysql экранирует пароль и требует TLS", () => {
    const cnf = mysqlOptionFile(parseDbUrl("mysql://user:pa%5Css%22q@db.example.invalid/koza"));
    expect(cnf).toContain('password="pa\\\\ss\\"q"');
    expect(cnf).toContain("ssl-mode=REQUIRED");
    expect(cnf).toContain("host=db.example.invalid");
  });
});

describe("db-url-parts CLI", () => {
  it("пишет части в GITHUB_ENV, пароль в файл 600 и не печатает user/password", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "db-url-parts-"));
    try {
      const githubEnv = path.join(dir, "github.env");
      const pwFile = path.join(dir, "src.pw");
      const cnfFile = path.join(dir, "src.cnf");
      const run = spawnSync(
        process.execPath,
        ["scripts/ci/db-url-parts.mjs", "--env", "FAKE_DB_URL", "--prefix", "SOURCE_DB_", "--password-file", pwFile, "--mysql-cnf", cnfFile, "--github-env"],
        {
          cwd: root,
          encoding: "utf8",
          env: { ...process.env, FAKE_DB_URL: "mysql://fixture.user:s3cr%40t@db.example.invalid:4000/koza?ssl=1", GITHUB_ENV: githubEnv },
        },
      );
      expect(run.status, run.stderr).toBe(0);
      expect(readFileSync(githubEnv, "utf8")).toBe("SOURCE_DB_HOST=db.example.invalid\nSOURCE_DB_PORT=4000\nSOURCE_DB_USER=fixture.user\nSOURCE_DB_NAME=koza\n");
      expect(readFileSync(pwFile, "utf8")).toBe("s3cr@t");
      expect(readFileSync(cnfFile, "utf8")).toContain('password="s3cr@t"');
      if (process.platform !== "win32") expect(statSync(pwFile).mode & 0o777).toBe(0o600);
      // В stdout — только маскирующие команды и host/db; пароль и user в открытом виде отсутствуют
      const visible = run.stdout.split("\n").filter((line) => !line.startsWith("::add-mask::")).join("\n");
      expect(visible).toContain("host=db.example.invalid");
      expect(visible).toContain("db=koza");
      expect(visible).not.toContain("s3cr@t");
      expect(visible).not.toContain("fixture.user");
      expect(run.stdout).toContain("::add-mask::s3cr@t");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("self-test проходит", () => {
    const run = spawnSync(process.execPath, ["scripts/ci/db-url-parts.mjs", "--self-test"], { cwd: root, encoding: "utf8" });
    expect(run.status, run.stdout + run.stderr).toBe(0);
    expect(run.stdout).toContain('"selfTest":"ok"');
  });
});
