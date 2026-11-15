import type { ReactNode } from "react";
import { Logo } from "@/components/logo";
import { NavLink } from "@/components/nav-link";
import { cn } from "@/components/ui";

export type NavItem = { href: string; label: string; exact?: boolean; step?: number };

const pill =
  "flex h-11 shrink-0 items-center whitespace-nowrap rounded-full px-3.5 text-[15px] text-ink/60 transition-colors duration-150 hover:text-ink";
const activePill = "bg-ink/[0.1] font-medium text-ink";

/**
 * Floating glass navigation bar, fixed near the top of the screen: the
 * wordmark, pill-shaped links, and whatever goes on the right (sign out).
 * On a narrow screen the links scroll sideways inside the bar.
 */
export function TopNav({ items, label, right }: { items: NavItem[]; label?: string; right?: ReactNode }) {
  return (
    <header className="pointer-events-none fixed inset-x-0 top-3 z-40 flex justify-center px-3 sm:top-5">
      <div className="glass glass-solid pointer-events-auto flex max-w-full items-center gap-1 rounded-full p-1.5">
        <span className="flex shrink-0 items-baseline gap-2 pl-3.5 pr-2">
          <Logo />
          {label && <span className="hidden font-mono text-[11px] uppercase tracking-[0.14em] text-ink-2 sm:inline">{label}</span>}
        </span>
        {items.length > 0 && (
          <nav aria-label="Main" className="no-scrollbar flex min-w-0 flex-nowrap gap-0.5 overflow-x-auto">
            {items.map((item) => (
              <NavLink key={item.href} href={item.href} exact={item.exact} className={pill} activeClassName={activePill}>
                {item.label}
              </NavLink>
            ))}
          </nav>
        )}
        {right && <div className="flex shrink-0 items-center gap-1 pl-1">{right}</div>}
      </div>
    </header>
  );
}

/**
 * The client's three steps, as one glass bar floating at the bottom of the
 * phone: thumb reach, and nothing else to choose from.
 */
export function BottomNav({ items }: { items: NavItem[] }) {
  return (
    <nav
      aria-label="Steps"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
    >
      <div className="glass glass-solid pointer-events-auto flex max-w-full gap-1 rounded-full p-1.5">
        {items.map((item) => (
          <NavLink
            key={item.href}
            href={item.href}
            exact={item.exact}
            className={cn(pill, "group h-12 gap-2 px-4")}
            activeClassName="bg-ink font-semibold text-on-gold hover:text-on-gold"
          >
            {item.step != null && (
              <span className="flex size-6 items-center justify-center rounded-full border border-current font-mono text-[11px]">
                {item.step}
              </span>
            )}
            {item.label}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
