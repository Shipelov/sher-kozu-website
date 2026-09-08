import mysql from 'mysql2/promise';
import 'dotenv/config';
const conn = await mysql.createConnection(process.env.DATABASE_URL);
const [rows] = await conn.query('SELECT openId, name, email FROM users');
rows.forEach(r => {
  const empty = !r.name;
  console.log(r.email, '| name:', JSON.stringify(r.name), '| empty:', empty);
});
await conn.end();
