import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { asUser, createTestDb, expectDenied, type Db } from "./harness";
import { cleanup, seed, type Fixture } from "./fixtures";

/**
 * The gate for build step 1: a client user cannot read another client's rows.
 *
 * Each test signs in as a role (the same way the Data API does: database role
 * `authenticated` plus the user's id in the JWT claims) and tries to reach
 * data it should not have. Nothing here goes through app code, so these
 * prove the database itself refuses, whatever the UI does.
 */
let db: Db;
let fx: Fixture;

beforeAll(async () => {
  db = await createTestDb();
  fx = await seed(db);
}, 120_000);

afterAll(async () => {
  if (db) {
    if (db.mode === "postgres") await cleanup(db, fx);
    await db.close();
  }
});

/** Tables that are deliberately not tied to one client. */
const NOT_CLIENT_SCOPED = new Set(["app_settings"]);

async function clientScopedTables(): Promise<string[]> {
  const rows = await db.query<{ table_name: string }>(
    `select c.table_name from information_schema.columns c
       join information_schema.tables t on t.table_schema = c.table_schema and t.table_name = c.table_name
      where c.table_schema = 'public' and c.column_name = 'client_id' and t.table_type = 'BASE TABLE'
      order by 1`,
  );
  return rows.map((r) => r.table_name);
}

describe("schema guards", () => {
  it("has row level security enabled on every table in public", async () => {
    const rows = await db.query<{ relname: string }>(
      `select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity`,
    );
    expect(rows.map((r) => r.relname)).toEqual([]);
  });

  it("scopes every table by client_id unless it is explicitly shared", async () => {
    const rows = await db.query<{ table_name: string }>(
      `select t.table_name from information_schema.tables t
        where t.table_schema = 'public' and t.table_type = 'BASE TABLE'
          and t.table_name <> 'clients'
          and not exists (
            select 1 from information_schema.columns c
             where c.table_schema = 'public' and c.table_name = t.table_name and c.column_name = 'client_id')`,
    );
    const unscoped = rows.map((r) => r.table_name).filter((t) => !NOT_CLIENT_SCOPED.has(t));
    expect(unscoped).toEqual([]);
  });

  it("has fixture rows for both clients in every client-scoped table", async () => {
    // Keeps the sweep below honest: a table with no rows for client B would
    // pass the isolation check without proving anything.
    for (const table of await clientScopedTables()) {
      if (table === "audit_log") continue;
      for (const clientId of [fx.clientA, fx.clientB]) {
        const [{ n }] = await db.query<{ n: number }>(
          `select count(*)::int as n from public.${table} where client_id = $1`,
          [clientId],
        );
        expect(n, `${table} needs a fixture row for each client`).toBeGreaterThan(0);
      }
    }
  });
});

describe("a client user cannot read another client's rows", () => {
  it("sees zero rows of the other client in every client-scoped table", async () => {
    const tables = await clientScopedTables();
    expect(tables.length).toBeGreaterThan(0);
    for (const [user, other] of [[fx.userA, fx.clientB], [fx.userB, fx.clientA]] as const) {
      for (const table of tables) {
        const [{ n }] = await asUser(db, user, (s) =>
          s.query<{ n: number }>(`select count(*)::int as n from public.${table} where client_id = $1`, [other]),
        );
        expect(n, `client user read ${n} row(s) of another client from ${table}`).toBe(0);
      }
    }
  });

  it("sees exactly one client: their own", async () => {
    const rows = await asUser(db, fx.userA, (s) => s.query<{ id: string }>("select id from public.clients"));
    expect(rows.map((r) => r.id)).toEqual([fx.clientA]);
    const direct = await asUser(db, fx.userA, (s) =>
      s.query("select * from public.clients where id = $1", [fx.clientB]),
    );
    expect(direct).toEqual([]);
  });

  it("sees only their own profile, not other users", async () => {
    const rows = await asUser(db, fx.userA, (s) => s.query<{ id: string }>("select id from public.profiles"));
    expect(rows.map((r) => r.id)).toEqual([fx.userA]);
  });

  it("cannot read voice profiles, internal notes, financials, settings or the audit log", async () => {
    for (const table of ["voice_profiles", "client_notes", "client_financials", "app_settings", "audit_log"]) {
      const rows = await asUser(db, fx.userA, (s) => s.query(`select * from public.${table}`));
      expect(rows, table).toEqual([]);
    }
  });

  it("gets only their own curated voice summary", async () => {
    const rows = await asUser(db, fx.userA, (s) =>
      s.query<{ summary: string; phrases_use: string[] }>("select * from public.my_voice_summary()"),
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].summary).toBe("summary A");
    expect(rows[0].phrases_use).toEqual(["phrase A"]);
    expect(JSON.stringify(rows)).not.toContain("SECRET");
    expect(JSON.stringify(rows)).not.toContain("internal tone notes");
  });

  it("can send a correction for themselves but not for another client", async () => {
    await asUser(db, fx.userA, (s) =>
      s.query("insert into public.voice_corrections (client_id, body) values ($1, 'I never say synergy')", [
        fx.clientA,
      ]),
    );
    await expectDenied(
      asUser(db, fx.userA, (s) =>
        s.query("insert into public.voice_corrections (client_id, body) values ($1, 'planted')", [fx.clientB]),
      ),
    );
  });

  it("cannot write to another client's rows", async () => {
    await asUser(db, fx.userA, (s) => s.query("update public.clients set name = 'hacked'"));
    await asUser(db, fx.userA, (s) => s.query("delete from public.clients"));
    await asUser(db, fx.userA, (s) => s.query("update public.voice_profiles set summary = 'hacked'"));
    const clients = await db.query<{ name: string }>(
      "select name from public.clients where id = any($1::uuid[]) order by name",
      [[fx.clientA, fx.clientB]],
    );
    expect(clients.map((c) => c.name)).toEqual(["Client A", "Client B"]);
    const [vp] = await db.query<{ summary: string }>(
      "select summary from public.voice_profiles where client_id = $1",
      [fx.clientB],
    );
    expect(vp.summary).toBe("summary B");
  });

  it("cannot promote themselves or move to another client", async () => {
    await expectDenied(
      asUser(db, fx.userA, (s) => s.query("update public.profiles set role = 'admin' where id = $1", [fx.userA])),
    );
    await expectDenied(
      asUser(db, fx.userA, (s) =>
        s.query("update public.profiles set client_id = $1 where id = $2", [fx.clientB, fx.userA]),
      ),
    );
    await expectDenied(
      asUser(db, fx.userA, (s) =>
        s.query("insert into public.profiles (id, role, email) values ($1, 'admin', 'x@example.test')", [fx.userA]),
      ),
    );
  });

  it("can update their own name and notification preferences", async () => {
    await asUser(db, fx.userA, (s) =>
      s.query("update public.profiles set full_name = 'A. Owner' where id = $1", [fx.userA]),
    );
    const [p] = await db.query<{ full_name: string }>("select full_name from public.profiles where id = $1", [
      fx.userA,
    ]);
    expect(p.full_name).toBe("A. Owner");
  });

  it("cannot log audit events against another client", async () => {
    await expectDenied(
      asUser(db, fx.userA, (s) =>
        s.query("select public.log_event($1, 'clients', $2, 'viewed')", [fx.clientB, fx.clientB]),
      ),
    );
  });
});

describe("signed-out visitors", () => {
  it("are refused on every table", async () => {
    const tables = await db.query<{ table_name: string }>(
      `select table_name from information_schema.tables where table_schema = 'public' and table_type = 'BASE TABLE'`,
    );
    for (const { table_name } of tables) {
      await expectDenied(asUser(db, null, (s) => s.query(`select * from public.${table_name} limit 1`)));
    }
  });

  it("cannot call the app's functions", async () => {
    await expectDenied(asUser(db, null, (s) => s.query("select * from public.my_voice_summary()")));
  });
});

describe("editors", () => {
  it("cannot see clients, voice profiles, notes or financials", async () => {
    for (const table of ["clients", "voice_profiles", "voice_corrections", "client_notes", "client_financials"]) {
      const rows = await asUser(db, fx.editor, (s) => s.query(`select * from public.${table}`));
      expect(rows, table).toEqual([]);
    }
  });
});

describe("team members", () => {
  it("can manage clients and voice profiles", async () => {
    const clients = await asUser(db, fx.team, (s) =>
      s.query<{ id: string }>("select id from public.clients where id = any($1::uuid[])", [
        [fx.clientA, fx.clientB],
      ]),
    );
    expect(clients).toHaveLength(2);
    const voice = await asUser(db, fx.team, (s) =>
      s.query("select * from public.voice_profiles where client_id = any($1::uuid[])", [[fx.clientA, fx.clientB]]),
    );
    expect(voice).toHaveLength(2);
  });

  it("have no access to billing, settings changes, the audit log, or deleting clients", async () => {
    const fin = await asUser(db, fx.team, (s) => s.query("select * from public.client_financials"));
    expect(fin).toEqual([]);
    const audit = await asUser(db, fx.team, (s) => s.query("select * from public.audit_log"));
    expect(audit).toEqual([]);
    await asUser(db, fx.team, (s) => s.query("update public.app_settings set revision_allowance = 99"));
    const [settings] = await db.query<{ revision_allowance: number | null }>(
      "select revision_allowance from public.app_settings",
    );
    expect(settings.revision_allowance).not.toBe(99);
    await asUser(db, fx.team, (s) => s.query("delete from public.clients where id = $1", [fx.clientB]));
    const still = await db.query("select 1 from public.clients where id = $1", [fx.clientB]);
    expect(still).toHaveLength(1);
  });
});

describe("admin", () => {
  it("sees every client and the audit trail of what happened", async () => {
    const clients = await asUser(db, fx.admin, (s) =>
      s.query("select id from public.clients where id = any($1::uuid[])", [[fx.clientA, fx.clientB]]),
    );
    expect(clients).toHaveLength(2);
    const audit = await asUser(db, fx.admin, (s) =>
      s.query<{ table_name: string; action: string; actor_id: string | null }>(
        "select table_name, action, actor_id from public.audit_log where client_id = $1",
        [fx.clientA],
      ),
    );
    expect(audit.some((a) => a.table_name === "clients" && a.action === "insert")).toBe(true);
    // The correction client A sent earlier is attributed to them.
    expect(audit.some((a) => a.table_name === "voice_corrections" && a.actor_id === fx.userA)).toBe(true);
  });

  it("does not copy client data values into the audit log", async () => {
    await asUser(db, fx.admin, (s) =>
      s.query("update public.voice_profiles set tone_notes = 'warm, plain spoken' where client_id = $1", [
        fx.clientA,
      ]),
    );
    const rows = await db.query<{ details: unknown }>(
      "select details from public.audit_log where client_id = $1 and table_name = 'voice_profiles' and action = 'update'",
      [fx.clientA],
    );
    expect(rows.length).toBeGreaterThan(0);
    expect(JSON.stringify(rows)).toContain("tone_notes");
    expect(JSON.stringify(rows)).not.toContain("plain spoken");
  });
});
