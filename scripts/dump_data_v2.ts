import { getDb } from "./server/db";
import { sql } from "drizzle-orm";
import * as fs from "fs";

async function main() {
  const db = await getDb();
  
  // Get all tables
  const tablesResult = await db.execute(sql`SHOW TABLES`);
  const tables = (tablesResult as any)[0] || tablesResult;
  const tableNames: string[] = [];
  for (const row of tables as any[]) {
    const name = Object.values(row)[0] as string;
    if (name !== "__drizzle_migrations") tableNames.push(name);
  }
  
  console.log(`Found ${tableNames.length} tables`);
  
  // Get JSON columns for each table
  const jsonColumns: Record<string, Set<string>> = {};
  for (const table of tableNames) {
    const colResult = await db.execute(sql.raw(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = '${table}' AND DATA_TYPE = 'json'`
    ));
    const cols = (colResult as any)[0] || colResult;
    if (Array.isArray(cols) && cols.length > 0) {
      jsonColumns[table] = new Set(cols.map((c: any) => c.COLUMN_NAME));
      console.log(`  ${table} has JSON columns: ${[...jsonColumns[table]].join(', ')}`);
    }
  }
  
  let output = "SET FOREIGN_KEY_CHECKS=0;\nSET SQL_MODE='NO_AUTO_VALUE_ON_ZERO';\n\n";
  let totalRows = 0;
  
  for (const table of tableNames) {
    try {
      const result = await db.execute(sql.raw(`SELECT * FROM \`${table}\``));
      const rows = (result as any)[0] || result;
      const rowArray = Array.isArray(rows) ? rows : [];
      console.log(`${table}: ${rowArray.length} rows`);
      totalRows += rowArray.length;
      
      if (rowArray.length === 0) continue;
      
      output += `TRUNCATE TABLE \`${table}\`;\n`;
      
      const cols = Object.keys(rowArray[0]);
      const colList = cols.map(c => `\`${c}\``).join(", ");
      const tableJsonCols = jsonColumns[table] || new Set();
      
      for (let i = 0; i < rowArray.length; i += 50) {
        const batch = rowArray.slice(i, i + 50);
        const values = batch.map((row: any) => {
          const vals = cols.map(c => {
            const v = row[c];
            if (v === null || v === undefined) return "NULL";
            
            // Handle JSON columns specially
            if (tableJsonCols.has(c)) {
              if (typeof v === 'object') {
                // Already parsed as object by mysql2
                const jsonStr = JSON.stringify(v);
                const escaped = jsonStr.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
                return `'${escaped}'`;
              }
              if (typeof v === 'string') {
                // Check if it's valid JSON
                try {
                  JSON.parse(v);
                  const escaped = v.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
                  return `'${escaped}'`;
                } catch {
                  // Not valid JSON - return NULL
                  return "NULL";
                }
              }
              return "NULL";
            }
            
            if (v instanceof Date) return `'${v.toISOString().slice(0,19).replace("T"," ")}'`;
            if (typeof v === "number") return String(v);
            if (typeof v === "boolean") return v ? "1" : "0";
            if (Buffer.isBuffer(v)) return `X'${v.toString("hex")}'`;
            const escaped = String(v).replace(/\\/g, "\\\\").replace(/'/g, "\\'").replace(/\n/g, "\\n").replace(/\r/g, "\\r").replace(/\0/g, "");
            return `'${escaped}'`;
          });
          return `(${vals.join(", ")})`;
        }).join(",\n");
        output += `INSERT INTO \`${table}\` (${colList}) VALUES\n${values};\n`;
      }
      output += "\n";
      
      // Write incrementally
      fs.writeFileSync("/tmp/tidb_dump_v2.sql", output);
    } catch (err: any) {
      console.error(`FAILED ${table}: ${err.message}`);
    }
  }
  
  output += "SET FOREIGN_KEY_CHECKS=1;\n";
  fs.writeFileSync("/tmp/tidb_dump_v2.sql", output);
  
  console.log(`\nDone! ${totalRows} total rows`);
  const size = fs.statSync("/tmp/tidb_dump_v2.sql").size;
  console.log(`File size: ${(size / 1024 / 1024).toFixed(2)} MB`);
  process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });
