import type { Metadata } from "next";
import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, Select, buttonClass } from "@/components/ui";
import { BOARD_STAGES, STAGES, formatDate, one, type Stage } from "@/lib/labels";
import { isUuid } from "@/lib/forms";

export const metadata: Metadata = { title: "Pipeline" };

type Card = {
  id: string;
  title: string;
  stage: Stage;
  updated_at: string;
  client: { name: string; business: string } | null;
  dueDate: string | null;
};

export default async function PipelinePage({ searchParams }: PageProps<"/team/pipeline">) {
  await requireStaff();
  const params = await searchParams;
  const clientFilter = typeof params.client === "string" && isUuid(params.client) ? params.client : "";

  const supabase = await createClient();
  let query = supabase
    .from("scripts")
    .select("id, title, stage, updated_at, client:clients(name, business), brief:shooting_briefs(due_date)")
    .order("updated_at", { ascending: false });
  if (clientFilter) query = query.eq("client_id", clientFilter);

  const [{ data: scripts }, { data: clients }] = await Promise.all([
    query,
    supabase.from("clients").select("id, name, business").neq("status", "offboarded").order("business"),
  ]);

  const byStage = new Map<Stage, Card[]>();
  for (const s of scripts ?? []) {
    // "approved" never rests; show any stragglers with awaiting_footage.
    const column = s.stage === "approved" ? "awaiting_footage" : s.stage;
    const card: Card = {
      id: s.id,
      title: s.title,
      stage: s.stage,
      updated_at: s.updated_at,
      client: one(s.client),
      dueDate: one(s.brief)?.due_date ?? null,
    };
    byStage.set(column, [...(byStage.get(column) ?? []), card]);
  }
  const today = new Date().toISOString().slice(0, 10);

  return (
    <>
      <PageHeader
        title="Pipeline"
        subtitle="Every script, across all clients."
        actions={
          <form className="flex items-center gap-2">
            <Select name="client" defaultValue={clientFilter} aria-label="Filter by client" className="min-w-48">
              <option value="">All clients</option>
              {clients?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.business || c.name}
                </option>
              ))}
            </Select>
            <button type="submit" className={buttonClass("secondary")}>
              Filter
            </button>
          </form>
        }
      />
      <div className="-mx-4 overflow-x-auto px-4 pb-4">
        <div className="flex gap-3" style={{ minWidth: `${BOARD_STAGES.length * 15}rem` }}>
          {BOARD_STAGES.map((stage) => {
            const cards = byStage.get(stage) ?? [];
            return (
              <section key={stage} className="w-60 shrink-0 rounded-xl bg-band p-2" aria-label={STAGES[stage].label}>
                <h2 className="flex items-center justify-between px-2 py-1.5 text-sm font-semibold text-ink">
                  {STAGES[stage].label}
                  <span className="text-ink-3">{cards.length}</span>
                </h2>
                <ul className="space-y-2">
                  {cards.map((card) => {
                    const overdue =
                      card.stage === "awaiting_footage" && card.dueDate != null && card.dueDate < today;
                    return (
                      <li key={card.id}>
                        <Link
                          href={`/team/scripts/${card.id}`}
                          className="block rounded-lg border border-line bg-surface p-3 text-sm hover:border-gold"
                        >
                          <span className="block font-semibold text-ink">{card.title}</span>
                          <span className="block text-ink-2">{card.client?.business || card.client?.name}</span>
                          <span className={overdue ? "text-xs font-semibold text-danger" : "text-xs text-ink-3"}>
                            {overdue
                              ? `Footage overdue since ${formatDate(card.dueDate)}`
                              : `Updated ${formatDate(card.updated_at)}`}
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
        </div>
      </div>
    </>
  );
}
