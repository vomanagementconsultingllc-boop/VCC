import { NavLink } from "@/components/nav-link";

export function ClientTabs({ clientId }: { clientId: string }) {
  const base = `/team/clients/${clientId}`;
  const tab = "rounded-lg px-3 py-2 text-sm font-semibold text-ink-2 hover:bg-band";
  const active = "bg-gold-soft text-gold-hover";
  return (
    <nav className="mb-5 flex flex-wrap gap-1" aria-label="Client sections">
      <NavLink href={base} exact className={tab} activeClassName={active}>
        Overview
      </NavLink>
      <NavLink href={`${base}/voice`} className={tab} activeClassName={active}>
        Voice profile
      </NavLink>
    </nav>
  );
}
