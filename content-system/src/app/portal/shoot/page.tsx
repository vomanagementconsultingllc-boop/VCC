import type { Metadata } from "next";
import Link from "next/link";
import { Guide } from "@/components/guide";
import { Badge, Eyebrow, buttonClass } from "@/components/ui";
import { requireOnboardedClient } from "@/lib/portal";

export const metadata: Metadata = { title: "Step 2: Shoot" };

/** Step 2. The videos that are ready to film, with how far along each one is. */
export default async function ShootPage() {
  const { supabase } = await requireOnboardedClient();
  const [{ data: scripts }, { data: shots }, { data: uploads }, { data: broll }] = await Promise.all([
    supabase.from("scripts").select("id, title, hook, stage").in("stage", ["awaiting_footage", "footage_received"]).order("footage_requested_at"),
    supabase.from("shots").select("id, script_id"),
    supabase.from("footage_uploads").select("script_id, shot_id, check_status").eq("superseded", false),
    supabase.from("broll_requests").select("id, status").neq("status", "accepted"),
  ]);

  const toFilm = (scripts ?? []).filter((s) => s.stage === "awaiting_footage");
  const sent = (scripts ?? []).filter((s) => s.stage === "footage_received");
  const progress = (scriptId: string) => {
    const total = (shots ?? []).filter((s) => s.script_id === scriptId).length;
    const mine = (uploads ?? []).filter((u) => u.script_id === scriptId);
    return {
      total,
      done: mine.filter((u) => u.check_status !== "failed").length,
      redo: mine.filter((u) => u.check_status === "failed").length,
    };
  };
  const redoCount = toFilm.reduce((sum, s) => sum + progress(s.id).redo, 0);
  const brollOpen = (broll ?? []).length;
  const brollRedo = (broll ?? []).filter((b) => b.status === "needs_reshoot").length;

  return (
    <div className="space-y-5">
      <header>
        <Eyebrow>Step 2 of 3</Eyebrow>
        <h1 className="mt-1 font-display text-4xl text-ink">Shoot</h1>
      </header>

      {redoCount > 0 || brollRedo > 0 ? (
        <Guide mood="oops">
          {redoCount + brollRedo === 1 ? "One clip needs" : `${redoCount + brollRedo} clips need`} another go. I have
          said exactly what to change on each one. It will only take a minute.
        </Guide>
      ) : toFilm.length > 0 ? (
        <Guide mood="happy">
          You have {toFilm.length === 1 ? "one video" : `${toFilm.length} videos`} to film. Tap one and I will walk you
          through it shot by shot: where to stand, how to hold the phone, and what to say.
        </Guide>
      ) : (
        <Guide mood="think">Nothing to film right now. Say yes to a video in step 1 and it will show up here.</Guide>
      )}

      <ul className="space-y-4">
        {toFilm.map((script) => {
          const p = progress(script.id);
          return (
            <li key={script.id} className="panel border border-ink/10 p-5">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <p className="min-w-0 flex-1 font-display text-2xl leading-snug text-ink">{script.title}</p>
                {p.redo > 0 ? <Badge tone="danger">{p.redo} to redo</Badge> : <Badge>{p.done} of {p.total} clips in</Badge>}
              </div>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-ink/10" aria-hidden>
                <div className="h-full rounded-full bg-ink" style={{ width: `${p.total ? Math.round((p.done / p.total) * 100) : 0}%` }} />
              </div>
              <Link href={`/portal/scripts/${script.id}`} className={buttonClass("primary", "mt-4 w-full")}>
                {p.done + p.redo === 0 ? "Start filming" : "Keep going"}
              </Link>
            </li>
          );
        })}
      </ul>

      {brollOpen > 0 && (
        <Link href="/portal/broll" className="panel flex items-center justify-between gap-3 border border-ink/10 p-5">
          <span>
            <span className="block font-semibold text-ink">Extra clips to film</span>
            <span className="text-sm text-ink-2">
              {brollOpen} short clip{brollOpen === 1 ? "" : "s"} we cut into your videos
              {brollRedo > 0 ? `, ${brollRedo} to redo` : ""}
            </span>
          </span>
          <span aria-hidden className="text-2xl text-ink-2">
            ›
          </span>
        </Link>
      )}

      {sent.length > 0 && (
        <section>
          <Eyebrow className="mb-2 text-ink-2">All clips in</Eyebrow>
          <ul className="space-y-2">
            {sent.map((script) => (
              <li key={script.id} className="flex items-center justify-between gap-3 rounded-2xl border border-ink/10 px-4 py-3 text-sm">
                <span className="text-ink">{script.title}</span>
                <Badge>With the editor soon</Badge>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
