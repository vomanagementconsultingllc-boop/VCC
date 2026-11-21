import type { ReactNode } from "react";
import { Logo } from "@/components/logo";
import { NavLink } from "@/components/nav-link";
import { cn } from "@/components/ui";

export type NavItem = { href: string; label: string; exact?: boolean; step?: number };

/** Small text link for the top row (Settings, Sign out). */
export const topLinkClass =
  "flex h-11 items-center whitespace-nowrap rounded-full px-3 font-mono text-[11px] uppercase tracking-[0.14em] text-ink-2 transition-colors duration-150 hover:text-ink";

/**
 * The one navigation pattern in the app, identical on a phone and on a
 * desktop: the wordmark on top, then a single row of tabs that stays at the
 * top of the screen while the page scrolls. Clients get three tabs (their
 * three steps) and so does the team.
 */
export function TopTabs({
  items,
  label,
  right,
  wide = false,
}: {
  items: NavItem[];
  /** Short tag beside the wordmark, e.g. "Editing". */
  label?: string;
  /** Quiet links on the right of the wordmark row. */
  right?: ReactNode;
  /** Match a wide page (team) instead of the narrow phone column (client). */
  wide?: boolean;
}) {
  const width = wide ? "max-w-[1200px] md:px-8" : "max-w-2xl";
  return (
    <>
      <header className={cn("mx-auto flex w-full items-center justify-between gap-3 px-5 pt-5", width)}>
        <span className="flex min-w-0 items-baseline gap-2">
          <Logo />
          {label && <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink-2">{label}</span>}
        </span>
        {right && <div className="flex shrink-0 items-center">{right}</div>}
      </header>
      {items.length > 1 && (
        <nav aria-label="Main" className="sticky top-0 z-40 px-3 pb-1 pt-[max(0.75rem,env(safe-area-inset-top))]">
          <div className="glass glass-solid mx-auto flex w-full max-w-xl gap-1 rounded-full p-1.5">
            {items.map((item) => (
              <NavLink
                key={item.href}
                href={item.href}
                exact={item.exact}
                className="flex h-11 min-w-0 flex-1 items-center justify-center gap-2 rounded-full px-2 text-[15px] text-ink/60 transition-colors duration-150 hover:text-ink"
                activeClassName="bg-ink font-semibold text-on-gold hover:text-on-gold"
              >
                {item.step != null && (
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full border border-current font-mono text-[11px]">
                    {item.step}
                  </span>
                )}
                <span className="truncate">{item.label}</span>
              </NavLink>
            ))}
          </div>
        </nav>
      )}
    </>
  );
}
