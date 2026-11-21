import { Eyebrow, PageHeader, buttonClass } from "@/components/ui";
import { ClientGrid, NeedsYou } from "@/components/team/needs-you";
import { pipelineHealth } from "@/lib/pipeline-health";
import { teamTodo } from "@/lib/team-todo";
import { DEMO_CLIENTS, DEMO_NOW, DEMO_SCRIPTS, DEMO_VIDEOS_HREF } from "./sample";

/** Demo of the team's home page: the to-do list, then the clients. */
export default function DemoTeamHome() {
  const health = pipelineHealth(DEMO_SCRIPTS, DEMO_NOW);
  const groups = teamTodo(DEMO_SCRIPTS, [], DEMO_NOW).map((g) => ({
    ...g,
    items: g.items.map((item) => ({ ...item, href: DEMO_VIDEOS_HREF })),
  }));
  return (
    <>
      <PageHeader
        title="Clients"
        subtitle="What needs you today, then everyone you make videos for."
        actions={<span className={buttonClass("primary")}>New client</span>}
      />
      <NeedsYou groups={groups} videosHref={DEMO_VIDEOS_HREF} />
      <Eyebrow className="mb-3 text-ink-2">Your clients</Eyebrow>
      <ClientGrid
        clients={DEMO_CLIENTS.map((c) => ({
          id: c.id,
          href: DEMO_VIDEOS_HREF,
          title: c.business,
          person: c.name,
          health: health.get(c.id),
        }))}
      />
    </>
  );
}
