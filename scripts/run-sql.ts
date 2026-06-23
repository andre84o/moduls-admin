import "dotenv/config";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Client } from "pg";

/**
 * Apply a raw SQL migration file against the database.
 *
 * The Supabase "direct connection" (port 5432) is often unreachable from local
 * networks, while the pooler (DATABASE_URL, port 6543) authenticates fine — so
 * this runner uses the same DATABASE_URL the app runs on. Statements are sent
 * via the simple query protocol (no prepared statements), which is compatible
 * with pgbouncer transaction pooling.
 *
 * Usage:
 *   npx tsx scripts/run-sql.ts scripts/sql/002_extend_media.sql
 */
async function main() {
  const fileArg = process.argv[2];
  if (!fileArg) {
    console.error("Usage: tsx scripts/run-sql.ts <path-to-sql-file>");
    process.exit(1);
  }

  const url = process.env.DATABASE_URL;
  if (!url || !/^postgres(ql)?:\/\//i.test(url) || url.includes("[")) {
    console.error("DATABASE_URL is not a valid connection string.");
    process.exit(1);
  }

  const filePath = resolve(process.cwd(), fileArg);
  const sql = readFileSync(filePath, "utf8");

  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    // One batched simple-query call runs every statement in the file in order.
    await client.query(sql);
    console.log(`Applied ${fileArg}`);
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
