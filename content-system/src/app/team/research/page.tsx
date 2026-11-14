import type { Metadata } from "next";
import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { Badge, ButtonLink, Card, CardTitle, EmptyState, Field, Input, PageHeader, Select, Textarea, buttonClass } from "@/components/ui";
import { FORMATS, formatDate } from "@/lib/labels";
import { OUTLIER_RATIO } from "@/lib/research/metrics";
import { addResearchItem, pullNiche, saveHook, setResearchStatus, turnIntoScript } from "./actions";

export const metadata: Metadata = { title: "Research" };

const compact = (n: number | null) => (n == null ? "?" : Intl.NumberFormat("en", { notation: "compact" }).format(n));

export default async function ResearchPage({ searchParams }: PageProps<"/team/research">) {
  await requireStaff();
  const params = await searchParams;
  const niche = typeof params.niche === "string" ? params.niche.toLowerCase() : "";
  const show = typeof params.show === "string" ? params.show : "open";
  const sort = params.sort === "recent" ? "recent" : "ratio";

  const supabase = await createClient();
  let query = supabase.from("research_items").select("*").limit(100);
  if (niche) query = query.contains("niche_tags", [niche]);
  if (show === "open") query = query.neq("status", "dismissed");
  else if (show === "worth_copying" || show === "dismissed") query = query.eq("status", show);
  query =
    sort === "recent"
      ? query.order("posted_at", { ascending: false, nullsFirst: false })
      : query.order("performance_ratio", { ascending: false, nullsFirst: false });

  const [{ data: items }, { data: clients }] = await Promise.all([
    query,
    supabase.from("clients").select("id, name, business, niche_tags").neq("status", "offboarded").order("business"),
  ]);
  // Niches come from client tags only: research is pulled per niche, never per client.
  const niches = [...new Set((clients ?? []).flatMap((c) => c.niche_tags))].sort();

  return (
    <>
      <PageHeader
        title="Research"
        subtitle={`Videos that beat their creator's own median. ${OUTLIER_RATIO}x or more counts as an outlier.`}
        actions={<ButtonLink href="/team/hooks" variant="secondary">Hook library</ButtonLink>}
      />

      <form className="mb-5 flex flex-wrap items-end gap-3">
        <label className="block">
          <span className="mb-1 block text-sm font-semibold">Niche</span>
          <Select name="niche" defaultValue={niche} className="min-w-44">
            <option value="">All niches</option>
            {niches.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </Select>
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-semibold">Show</span>
          <Select name="show" defaultValue={show}>
            <option value="open">Not dismissed</option>
            <option value="worth_copying">Worth copying</option>
            <option value="dismissed">Dismissed</option>
            <option value="all">Everything</option>
          </Select>
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-semibold">Sort</span>
          <Select name="sort" defaultValue={sort}>
            <option value="ratio">Performance ratio</option>
            <option value="recent">Most recent</option>
          </Select>
        </label>
        <button type="submit" className={buttonClass("secondary")}>
          Apply
        </button>
      </form>

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {!items?.length ? (
            <EmptyState title="Nothing on the board">Pull a niche or add a video by hand.</EmptyState>
          ) : (
            items.map((item) => {
              const ratio = item.performance_ratio == null ? null : Number(item.performance_ratio);
              return (
                <Card key={item.id}>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-ink">
                        @{item.creator_handle || "unknown"} <span className="font-normal text-ink-3">· {item.platform}</span>
                      </p>
                      <p className="text-sm text-ink-2">
                        {compact(item.view_count)} views · median {compact(item.creator_median_views)}
                        {item.posted_at && ` · ${formatDate(item.posted_at)}`}
                        {item.format_label && ` · ${FORMATS[item.format_label]}`}
                      </p>
                    </div>
                    <span className="flex flex-wrap gap-1.5">
                      {ratio != null ? (
                        <Badge tone={ratio >= OUTLIER_RATIO ? "success" : "neutral"}>{ratio}x median</Badge>
                      ) : (
                        <Badge tone="warning">No median yet</Badge>
                      )}
                      {item.status === "worth_copying" && <Badge tone="gold">Worth copying</Badge>}
                      {item.status === "dismissed" && <Badge>Dismissed</Badge>}
                    </span>
                  </div>
                  {item.hook_text && <p className="mt-3 font-display text-lg text-ink">“{item.hook_text}”</p>}
                  <p className="mt-2 text-sm">
                    <a href={item.source_url} target="_blank" rel="noopener noreferrer" className="font-semibold text-gold-hover underline">
                      Watch the video
                    </a>
                    <span className="text-ink-3"> · {item.niche_tags.join(", ") || "no niche"}</span>
                  </p>
                  {item.transcript && (
                    <details className="mt-2">
                      <summary className="cursor-pointer text-sm font-semibold text-ink">Transcript or caption</summary>
                      <p className="mt-1 whitespace-pre-wrap text-sm text-ink-2">{item.transcript}</p>
                    </details>
                  )}

                  <div className="mt-4 grid gap-4 border-t border-line pt-4 sm:grid-cols-2">
                    <ActionForm action={turnIntoScript} className="space-y-2">
                      <input type="hidden" name="item_id" value={item.id} />
                      <Select name="client_id" aria-label="Client" defaultValue="">
                        <option value="" disabled>
                          Turn into a script for…
                        </option>
                        {clients?.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.business || c.name}
                          </option>
                        ))}
                      </Select>
                      <SubmitButton pendingLabel="Creating…">Turn into script</SubmitButton>
                    </ActionForm>
                    <ActionForm action={saveHook} className="space-y-2">
                      <input type="hidden" name="item_id" value={item.id} />
                      <Input name="text" aria-label="Hook text" defaultValue={item.hook_text} placeholder="The hook, word for word" />
                      <div className="flex flex-wrap gap-2">
                        <Select name="format_type" aria-label="Hook type" className="w-auto flex-1" defaultValue="bold_claim">
                          <option value="question">Question</option>
                          <option value="bold_claim">Bold claim</option>
                          <option value="contrarian">Contrarian</option>
                          <option value="story_open">Story open</option>
                          <option value="number_list">Number list</option>
                        </Select>
                        <SubmitButton variant="secondary">Save hook</SubmitButton>
                      </div>
                    </ActionForm>
                  </div>
                  <form action={setResearchStatus} className="mt-3 flex flex-wrap gap-2">
                    <input type="hidden" name="item_id" value={item.id} />
                    {item.status !== "worth_copying" && (
                      <button type="submit" name="status" value="worth_copying" className={buttonClass("ghost")}>
                        Mark worth copying
                      </button>
                    )}
                    {item.status !== "dismissed" ? (
                      <button type="submit" name="status" value="dismissed" className={buttonClass("ghost")}>
                        Dismiss
                      </button>
                    ) : (
                      <button type="submit" name="status" value="new" className={buttonClass("ghost")}>
                        Restore
                      </button>
                    )}
                  </form>
                </Card>
              );
            })
          )}
        </div>

        <aside className="space-y-5">
          <Card>
            <CardTitle>Pull outliers for a niche</CardTitle>
            <p className="mb-3 text-sm text-ink-2">
              Runs weekly on its own. Only the niche keyword is sent to the scraper, never a client name or script.
            </p>
            <ActionForm action={pullNiche} className="space-y-3">
              <Select name="niche" aria-label="Niche" defaultValue={niche || niches[0] || ""}>
                {niches.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </Select>
              <SubmitButton variant="secondary" pendingLabel="Pulling… this can take a minute">
                Pull now
              </SubmitButton>
            </ActionForm>
          </Card>
          <Card>
            <CardTitle>Add a video by hand</CardTitle>
            <ActionForm action={addResearchItem} resetOnSuccess className="space-y-3">
              <Field label="Link">
                <Input name="source_url" type="url" required placeholder="https://www.tiktok.com/@…" />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Platform">
                  <Select name="platform" defaultValue="tiktok">
                    <option value="tiktok">TikTok</option>
                    <option value="instagram">Instagram</option>
                    <option value="youtube">YouTube</option>
                    <option value="other">Other</option>
                  </Select>
                </Field>
                <Field label="Creator">
                  <Input name="creator_handle" placeholder="@handle" />
                </Field>
                <Field label="Views">
                  <Input name="view_count" inputMode="numeric" required />
                </Field>
                <Field label="Creator median" hint="Last 20 posts.">
                  <Input name="creator_median_views" inputMode="numeric" />
                </Field>
                <Field label="Followers">
                  <Input name="follower_count" inputMode="numeric" />
                </Field>
                <Field label="Posted">
                  <Input name="posted_at" type="date" />
                </Field>
              </div>
              <Field label="Niche tags" hint="Comma separated.">
                <Input name="niche_tags" defaultValue={niche} />
              </Field>
              <Field label="Hook" hint="First spoken sentence or first on-screen text. Left blank, it is read from the transcript.">
                <Input name="hook_text" />
              </Field>
              <Field label="Transcript or caption">
                <Textarea name="transcript" />
              </Field>
              <SubmitButton pendingLabel="Adding…">Add to board</SubmitButton>
            </ActionForm>
          </Card>
        </aside>
      </div>
    </>
  );
}
