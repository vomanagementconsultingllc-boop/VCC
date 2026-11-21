import { NavLink } from "@/components/nav-link";

export function ClientTabs({ clientId }: { clientId: string }) {
  const base = `/team/clients/${clientId}`;
  const tab = "rounded-2xl px-3 py-2 text-sm font-semibold text-ink-2 hover:bg-band";
  const active = "bg-gold-soft text-gold-hover";
  return (
    <nav className="mb-5 flex flex-wrap gap-1" aria-label="Client sections">
      <NavLink href={base} exact className={tab} activeClassName={active}>
        About
      </NavLink>
      <NavLink href={`${base}/voice`} className={tab} activeClassName={active}>
        Voice
      </NavLink>
      <NavLink href={`${base}/scripts`} className={tab} activeClassName={active}>
        Videos
      </NavLink>
      <NavLink href={`${base}/broll`} className={tab} activeClassName={active}>
        B-roll
      </NavLink>
    </nav>
  );
}
