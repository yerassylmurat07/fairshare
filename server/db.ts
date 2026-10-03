import { PGlite } from "@electric-sql/pglite";
import pg from "pg";
import { mkdir } from "node:fs/promises";
import { readFile } from "node:fs/promises";
export interface Sql {
  query<T = Record<string, unknown>>(
    sql: string,
    values?: unknown[],
  ): Promise<{ rows: T[] }>;
}
export interface Database extends Sql {
  transaction<T>(fn: (tx: Sql) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}
export async function createDatabase(
  path = process.env.DATA_DIR || ".data/postgres",
): Promise<Database> {
  if (process.env.DATABASE_URL) {
    const pool = new pg.Pool({
      connectionString: process.env.DATABASE_URL,
      max: 10,
    });
    return {
      query: async <T>(sql: string, values?: unknown[]) => ({
        rows: (await pool.query(sql, values)).rows as T[],
      }),
      transaction: async <T>(fn: (tx: Sql) => Promise<T>) => {
        const client = await pool.connect();
        try {
          await client.query("BEGIN");
          const value = await fn({
            query: async <R>(sql: string, values?: unknown[]) => ({
              rows: (await client.query(sql, values)).rows as R[],
            }),
          });
          await client.query("COMMIT");
          return value;
        } catch (error) {
          await client.query("ROLLBACK");
          throw error;
        } finally {
          client.release();
        }
      },
      close: () => pool.end(),
    };
  }
  if (path !== "memory://") await mkdir(path, { recursive: true });
  const db = new PGlite(path);
  return {
    query: async <T>(sql: string, values?: unknown[]) => ({
      rows: (await db.query<T>(sql, values)).rows,
    }),
    transaction: (fn) =>
      db.transaction((tx) =>
        fn({
          query: async <T>(sql: string, values?: unknown[]) => ({
            rows: (await tx.query<T>(sql, values)).rows,
          }),
        }),
      ),
    close: () => db.close(),
  };
}
export async function migrate(db: Database) {
  const sql = await readFile(new URL("./schema.sql", import.meta.url), "utf8");
  // Each startup serializes migration setup across external PostgreSQL connections.
  await db.transaction(async (tx) => {
    await tx.query("SELECT pg_advisory_xact_lock(4133001)");
    for (const statement of sql.split(";").filter((s) => s.trim()))
      await tx.query(statement);
  });
}
