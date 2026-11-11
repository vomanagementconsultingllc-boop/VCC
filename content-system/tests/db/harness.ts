import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import pg from "pg";

/**
 * Test database for the RLS suite.
 *
 * Default: an embedded Postgres (PGlite) with a small Supabase shim, so
 * `npm test` needs no Docker and no network.
 *
 * With TEST_DATABASE_URL set (for example the local Supabase database at
 * postgresql://postgres:postgres@127.0.0.1:54322/postgres after
 * `supabase db reset`), the same tests run against the real thing.
 */
export interface Db {
  mode: "pglite" | "postgres";
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]>;
  exec(sql: string): Promise<void>;
  close(): Promise<void>;
}

const root = join(__dirname, "..", "..");
const migrationsDir = join(root, "supabase", "migrations");

export function migrationFiles(): string[] {
  return readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();
}

export async function createTestDb(): Promise<Db> {
  const url = process.env.TEST_DATABASE_URL;
  if (url) {
    const client = new pg.Client({ connectionString: url });
    await client.connect();
    return {
      mode: "postgres",
      async query<T>(sql: string, params: unknown[] = []) {
        const res = await client.query(sql, params);
        return res.rows as T[];
      },
      async exec(sql: string) {
        await client.query(sql);
      },
      async close() {
        await client.end();
      },
    };
  }

  const lite = new PGlite();
  await lite.exec(readFileSync(join(__dirname, "supabase-shim.sql"), "utf8"));
  for (const file of migrationFiles()) {
    try {
      await lite.exec(readFileSync(join(migrationsDir, file), "utf8"));
    } catch (err) {
      throw new Error(`migration ${file} failed: ${(err as Error).message}`);
    }
  }
  return {
    mode: "pglite",
    async query<T>(sql: string, params: unknown[] = []) {
      const res = await lite.query(sql, params);
      return res.rows as T[];
    },
    async exec(sql: string) {
      await lite.exec(sql);
    },
    async close() {
      await lite.close();
    },
  };
}

export type Session = {
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]>;
};

/**
 * Run `fn` exactly the way the Data API runs a request for a signed-in user:
 * inside a transaction, as the `authenticated` database role, with the user's
 * id in the JWT claims. Pass null to run as a signed-out visitor (`anon`).
 * The transaction commits on success and rolls back on error.
 */
export async function asUser<T>(db: Db, userId: string | null, fn: (s: Session) => Promise<T>): Promise<T> {
  const role = userId ? "authenticated" : "anon";
  const claims = userId ? { sub: userId, role } : { role };
  await db.exec("begin");
  try {
    await db.query("select set_config('role', $1, true)", [role]);
    await db.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify(claims)]);
    const result = await fn({ query: (sql, params) => db.query(sql, params) });
    await db.exec("commit");
    return result;
  } catch (err) {
    await db.exec("rollback");
    throw err;
  }
}

/** Expect a statement to be refused outright (privilege or RLS check). */
export async function expectDenied(promise: Promise<unknown>): Promise<void> {
  let error: unknown;
  try {
    await promise;
  } catch (err) {
    error = err;
  }
  if (!error) {
    throw new Error("expected the statement to be denied, but it succeeded");
  }
  const code = (error as { code?: string }).code;
  // 42501 = insufficient_privilege (also raised for RLS WITH CHECK failures)
  if (code !== "42501") {
    throw new Error(`expected a permission error (42501), got ${code}: ${(error as Error).message}`);
  }
}
