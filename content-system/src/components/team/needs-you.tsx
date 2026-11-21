import Link from "next/link";
import { Badge, Eyebrow } from "@/components/ui";
import type { Health } from "@/lib/pipeline-health";
import type { TodoGroup } from "@/lib/team-todo";

// Enough to see what each job is; the rest are one tap away on Videos.
const SHOWN_PER_GROUP = 4;

/** The team's to-do list: one card per kind of job, each line a link to where it gets done. */
export function NeedsYou({ groups, videosHref }: { groups: TodoGroup[]; videosHref: string }) {
  return (
    <section className="mb-10" aria-labelledby="needs-you">
      <Eyebrow id="needs-you" className="mb-3 text-ink-2">
        Needs you
      </Eyebrow>
      {!groups.length ? (
        <p className="panel border border-ink/[0.06] px-5 py-4 text-ink-2">
          Nothing is waiting on you. Everything in progress is with a client or an editor.
        </p>
      ) : (
        <ul className="grid gap-3 lg:grid-cols-2">
          {groups.map((group) => (
            <li key={group.kind} className="panel border border-ink/10 p-5">
              <p className="flex items-center justify-between gap-3 text-ink">
                <span className="font-display text-2xl">{group.label}</span>
                <span className="flex h-7 min-w-7 items-center justify-center rounded-full bg-ink px-2 text-sm font-semibold text-on-gold">
                  {group.items.length}
                </span>
              </p>
              <p className="mt-1 text-sm text-ink-2">{group.hint}</p>
              <ul className="mt-3 divide-y divide-line">
                {group.items.slice(0, SHOWN_PER_GROUP).map((item) => (
                  <li key={item.id}>
                    <Link href={item.href} className="flex min-h-11 items-center justify-between gap-3 py-2 text-sm hover:text-gold">
                      <span className="min-w-0 truncate font-semibold text-ink">{item.title}</span>
                      <span className="shrink-0 text-ink-2">{item.client}</span>
                    </Link>
                  </li>
                ))}
              </ul>
              {group.items.length > SHOWN_PER_GROUP && (
                <Link href={videosHref} className="mt-2 inline-block text-sm font-semibold text-ink-2 hover:text-ink">
                  and {group.items.length - SHOWN_PER_GROUP} more in Videos →
                </Link>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export type ClientCard = {
  id: string;
  href: string;
  title: string;
  /** The person's name, when the title is the business. */
  person?: string;
  /** Shown only when it is not the normal "active". */
  status?: { label: string; tone: "neutral" | "info" | "success" | "warning" | "danger" | "gold" };
  health?: Health;
};

/** One card per client: who they are and what is in progress for them. */
export function ClientGrid({ clients }: { clients: ClientCard[] }) {
  return (
    <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {clients.map((c) => {
        const h = c.health;
        return (
          <li key={c.id}>
            <Link href={c.href} className="block h-full panel border border-ink/[0.06] p-5 hover:border-gold">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold text-ink">{c.title}</p>
                  {c.person && <p className="text-sm text-ink-2">{c.person}</p>}
                </div>
                {c.status && <Badge tone={c.status.tone}>{c.status.label}</Badge>}
              </div>
              <p className="mt-3 flex flex-wrap gap-1.5">
                {h?.waiting ? <Badge tone="warning">{h.waiting} waiting on them to approve</Badge> : null}
                {h?.overdue ? <Badge tone="danger">{h.overdue} late to film</Badge> : null}
                {h?.editing ? <Badge tone="gold">{h.editing} being edited</Badge> : null}
                {!h?.waiting && !h?.overdue && !h?.editing && <Badge>Nothing in progress</Badge>}
              </p>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
