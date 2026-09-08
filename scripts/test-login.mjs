import mysql from 'mysql2/promise';
import 'dotenv/config';

const conn = await mysql.createConnection(process.env.DATABASE_URL);
const [rows] = await conn.query('SELECT openId, name, email, passwordHash FROM users WHERE email = ?', ['test.admin@sherkozu.ru']);
console.log('Has password:', !!rows[0]?.passwordHash);
console.log('Password hash prefix:', rows[0]?.passwordHash?.substring(0, 10));

// Also check sweetieari
const [rows2] = await conn.query('SELECT openId, name, email, passwordHash FROM users WHERE email = ?', ['sweetieari@icloud.com']);
console.log('sweetieari has password:', !!rows2[0]?.passwordHash);

// Check all users with passwords
const [rows3] = await conn.query('SELECT email, name FROM users WHERE passwordHash IS NOT NULL AND passwordHash != ""');
console.log('Users with passwords:', rows3.map(r => r.email));

await conn.end();
