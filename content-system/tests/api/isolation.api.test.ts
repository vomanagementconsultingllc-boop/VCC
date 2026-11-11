import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { anonymous, createWorld, destroyWorld, type World } from "./helpers";

/**
 * The same isolation guarantees as tests/db, but end to end: each role signs
 * in through the real auth service with a one-time link and talks to the
 * real Data API. Needs `npx supabase start`.
 */
let w: World;

beforeAll(async () => {
  w = await createWorld();
});

afterAll(async () => {
  if (w) await destroyWorld(w);
});

describe("client user, signed in for real", () => {
  it("can read their own client and nobody else's", async () => {
    const { data, error } = await w.sessions.a.from("clients").select("id, name");
    expect(error).toBeNull();
    expect(data).toEqual([{ id: w.clientA, name: "Client A" }]);

    const other = await w.sessions.a.from("clients").select("*").eq("id", w.clientB);
    expect(other.data).toEqual([]);
  });

  it("cannot read another client's rows from any client-scoped table", async () => {
    for (const table of ["voice_profiles", "voice_corrections", "client_notes", "client_financials", "profiles", "audit_log"] as const) {
      const { data } = await w.sessions.a.from(table).select("*").eq("client_id", w.clientB);
      expect(data ?? [], table).toEqual([]);
    }
  });

  it("cannot read internal tables even for their own client", async () => {
    for (const table of ["voice_profiles", "client_notes", "client_financials", "audit_log", "app_settings"] as const) {
      const { data } = await w.sessions.a.from(table).select("*");
      expect(data ?? [], table).toEqual([]);
    }
  });

  it("gets only their own voice summary", async () => {
    const { data, error } = await w.sessions.a.rpc("my_voice_summary");
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
    expect(data![0].summary).toBe("summary A");
    expect(JSON.stringify(data)).not.toContain("SECRET");
  });

  it("cannot write into another client or change their own role", async () => {
    const planted = await w.sessions.a.from("voice_corrections").insert({ client_id: w.clientB, body: "planted" });
    expect(planted.error).not.toBeNull();

    const own = await w.sessions.a.from("voice_corrections").insert({ client_id: w.clientA, body: "that is not how I talk" });
    expect(own.error).toBeNull();

    const promote = await w.sessions.a.from("profiles").update({ role: "admin" }).eq("id", w.userA);
    expect(promote.error).not.toBeNull();

    await w.sessions.a.from("clients").update({ name: "hacked" }).eq("id", w.clientB);
    const { data } = await w.sessions.admin.from("clients").select("name").eq("id", w.clientB).single();
    expect(data?.name).toBe("Client B");
  });
});

describe("signed-out visitor", () => {
  it("gets nothing", async () => {
    const anon = anonymous();
    for (const table of ["clients", "profiles", "voice_profiles", "audit_log"] as const) {
      const { data, error } = await anon.from(table).select("*").limit(1);
      expect(data ?? [], table).toEqual([]);
      expect(error, table).not.toBeNull();
    }
    const rpc = await anon.rpc("my_voice_summary");
    expect(rpc.error).not.toBeNull();
  });

  it("cannot create an account for themselves", async () => {
    const anon = anonymous();
    const { data, error } = await anon.auth.signUp({ email: `intruder-${w.tag}@example.test`, password: "long-enough-password-1" });
    expect(error).not.toBeNull();
    expect(data.session).toBeNull();

    const otp = await anon.auth.signInWithOtp({ email: `intruder-${w.tag}@example.test` });
    expect(otp.error).not.toBeNull();
  });
});

describe("editor", () => {
  it("cannot see clients or voice profiles", async () => {
    for (const table of ["clients", "voice_profiles", "client_notes", "client_financials"] as const) {
      const { data } = await w.sessions.editor.from(table).select("*");
      expect(data ?? [], table).toEqual([]);
    }
  });
});

describe("team member", () => {
  it("manages clients but has no billing or audit access", async () => {
    const clients = await w.sessions.team.from("clients").select("id").in("id", [w.clientA, w.clientB]);
    expect(clients.data).toHaveLength(2);
    const fin = await w.sessions.team.from("client_financials").select("*");
    expect(fin.data).toEqual([]);
    const audit = await w.sessions.team.from("audit_log").select("*");
    expect(audit.data).toEqual([]);
  });
});

describe("admin", () => {
  it("sees both clients, pricing, and who did what", async () => {
    const fin = await w.sessions.admin.from("client_financials").select("client_id").in("client_id", [w.clientA, w.clientB]);
    expect(fin.data).toHaveLength(2);
    const audit = await w.sessions.admin
      .from("audit_log")
      .select("actor_id, table_name, action")
      .eq("client_id", w.clientA)
      .eq("table_name", "voice_corrections");
    expect(audit.data?.some((row) => row.actor_id === w.userA && row.action === "insert")).toBe(true);
  });
});
