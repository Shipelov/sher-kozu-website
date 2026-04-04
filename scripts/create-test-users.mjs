/**
 * Create two test users for agent-based testing.
 * User 1: Regular owner (role: user)
 * User 2: Admin (role: admin)
 * 
 * Both use local auth with email + password.
 * Run: node scripts/create-test-users.mjs
 */

import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import mysql from "mysql2/promise";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load env
dotenv.config({ path: resolve(__dirname, "../.env") });

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL not set");
  process.exit(1);
}

const SALT_ROUNDS = 12;

const TEST_USERS = [
  {
    name: "Тестовый Владелец",
    email: "test.owner@sherkozu.ru",
    password: "TestOwner2026!",
    phone: "+79001234567",
    role: "user",
    label: "Тестовый пользователь (владелец)",
  },
  {
    name: "Тестовый Администратор",
    email: "test.admin@sherkozu.ru",
    password: "TestAdmin2026!",
    phone: "+79009876543",
    role: "admin",
    label: "Тестовый администратор",
  },
];

async function main() {
  // Parse DATABASE_URL
  const url = new URL(DATABASE_URL);
  const connection = await mysql.createConnection({
    host: url.hostname,
    port: parseInt(url.port || "3306"),
    user: url.username,
    password: url.password,
    database: url.pathname.slice(1),
    ssl: { rejectUnauthorized: false },
  });

  console.log("Connected to database.\n");

  for (const user of TEST_USERS) {
    // Check if user already exists
    const [existing] = await connection.execute(
      "SELECT id, openId, role FROM users WHERE email = ?",
      [user.email]
    );

    if (existing.length > 0) {
      const ex = existing[0];
      console.log(`⚠️  ${user.label} already exists (id=${ex.id}, openId=${ex.openId}, role=${ex.role})`);
      
      // Update role if needed
      if (ex.role !== user.role) {
        await connection.execute(
          "UPDATE users SET role = ? WHERE id = ?",
          [user.role, ex.id]
        );
        console.log(`   → Role updated to "${user.role}"`);
      }
      
      // Update password
      const passwordHash = await bcrypt.hash(user.password, SALT_ROUNDS);
      await connection.execute(
        "UPDATE users SET passwordHash = ? WHERE id = ?",
        [passwordHash, ex.id]
      );
      console.log(`   → Password reset to: ${user.password}`);
      console.log();
      continue;
    }

    // Create new user
    const openId = `local_${crypto.randomUUID().replace(/-/g, "").slice(0, 24)}`;
    const passwordHash = await bcrypt.hash(user.password, SALT_ROUNDS);

    await connection.execute(
      `INSERT INTO users (openId, name, email, phone, passwordHash, loginMethod, role, lastSignedIn, onboardingCompleted)
       VALUES (?, ?, ?, ?, ?, 'local', ?, NOW(), false)`,
      [openId, user.name, user.email, user.phone, passwordHash, user.role]
    );

    console.log(`✅ ${user.label} создан:`);
    console.log(`   OpenID: ${openId}`);
    console.log(`   Email:  ${user.email}`);
    console.log(`   Пароль: ${user.password}`);
    console.log(`   Роль:   ${user.role}`);
    console.log();

    // Create wallet for gamification
    try {
      await connection.execute(
        `INSERT IGNORE INTO wallets (ownerOpenId, balance) VALUES (?, 0)`,
        [openId]
      );
      console.log(`   → Кошелёк создан`);
    } catch (e) {
      console.log(`   → Кошелёк: пропущен (${e.message})`);
    }
  }

  console.log("═══════════════════════════════════════════");
  console.log("УЧЁТНЫЕ ДАННЫЕ ТЕСТОВЫХ ПОЛЬЗОВАТЕЛЕЙ:");
  console.log("═══════════════════════════════════════════");
  console.log();
  for (const user of TEST_USERS) {
    console.log(`${user.label}:`);
    console.log(`  Email:  ${user.email}`);
    console.log(`  Пароль: ${user.password}`);
    console.log(`  Роль:   ${user.role}`);
    console.log();
  }

  await connection.end();
  console.log("Done.");
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
