import type { Metadata } from "next";
import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { Badge, Card, EmptyState, PageHeader, Select } from "@/components/ui";
import { formatDate, one } from "@/lib/labels";
import { turnIntoScript } from "../research/actions";

export const metadata: Metadata = { title: "Hook library" };

const HOOK_LABEL: Record<string, string> = {
  question: "Question",
  bold_claim: "Bold claim",
  contrarian: "Contrarian",
  story_open: "Story open",
  number_list: "Number list",
};

export default async function HooksPage() {
  await requireStaff();
  const supabase = await createClient();
  const [{ data: hooks }, { data: clients }, { data: uses }] = await Promise.all([
    supabase.from("hook_rankings").select("*").eq("archived", false).order("score", { ascending: false }).limit(200),
    supabase.from("clients").select("id, name, business").neq("status", "offboarded").order("business"),
    supabase.from("hook_uses").select("hook_id, used_at, client:clients(name, business), script:scripts(stage)"),
  ]);

  return (
    <>
      <PageHeader
        title="Hook library"
        subtitle="Your saved openings, strongest first. A hook counts for less once the video behind it is more than 60 days old."
        back={{ href: "/team/research", label: "Research" }}
      />
      {!hooks?.length ? (
        <EmptyState title="No hooks saved yet">Save hooks from the research board.</EmptyState>
      ) : (
        <ul className="space-y-4">
          {hooks.map((hook) => {
            const history = (uses ?? []).filter((u) => u.hook_id === hook.id);
            return (
              <li key={hook.id}>
                <Card>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <p className="min-w-0 flex-1 font-display text-xl text-ink">“{hook.text}”</p>
                    <span className="flex flex-wrap gap-1.5">
                      <Badge tone="gold">Score {Number(hook.score ?? 0)}</Badge>
                      <Badge>{HOOK_LABEL[hook.format_type ?? ""] ?? "Hook"}</Badge>
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-ink-2">
                    {hook.performance_ratio != null ? `${Number(hook.performance_ratio)}x median` : "No ratio"}
                    {hook.creator_handle && ` · @${hook.creator_handle}`}
                    {hook.posted_at && ` · posted ${formatDate(hook.posted_at)}`}
                    {` · ${(hook.niche_tags ?? []).join(", ") || "no niche"}`}
                    {` · used ${Number(hook.times_used ?? 0)} time${Number(hook.times_used ?? 0) === 1 ? "" : "s"}`}
                  </p>
                  {history.length > 0 && (
                    <p className="mt-2 text-sm text-ink-2">
                      <span className="font-semibold text-ink">Used for: </span>
                      {history
                        .map((u) => {
                          const c = one(u.client);
                          const stage = one(u.script)?.stage;
                          return `${c?.business || c?.name || "client"}${stage === "posted" ? " (posted)" : ""}`;
                        })
                        .join(", ")}
                    </p>
                  )}
                  <ActionForm action={turnIntoScript} className="mt-4 flex flex-wrap items-end gap-2">
                    <input type="hidden" name="hook_id" value={hook.id ?? ""} />
                    <Select name="client_id" aria-label="Client" className="w-auto min-w-52" defaultValue="">
                      <option value="" disabled>
                        Use for a client…
                      </option>
                      {clients?.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.business || c.name}
                        </option>
                      ))}
                    </Select>
                    <SubmitButton variant="secondary" pendingLabel="Creating…">
                      Start a script
                    </SubmitButton>
                  </ActionForm>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
