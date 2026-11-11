import { Suspense, type ReactNode } from "react";
import { requireClient } from "@/lib/auth";
import { NavLink } from "@/components/nav-link";
import { PageLoading } from "@/components/ui";

const NAV = [
  { href: "/portal", label: "To do", exact: true },
  { href: "/portal/delivered", label: "Delivered", exact: false },
  { href: "/portal/settings", label: "Settings", exact: false },
];

/** Client portal. Built for the phone the client shoots on. */
export default function PortalLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<PageLoading />}>
      <PortalShell>{children}</PortalShell>
    </Suspense>
  );
}

async function PortalShell({ children }: { children: ReactNode }) {
  await requireClient();
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex w-full max-w-2xl items-center justify-between px-4 py-3">
          <span className="font-display text-lg text-ink">Vo Creative Co.</span>
        </div>
      </header>
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 pb-28 pt-5">{children}</main>
      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)]"
      >
        <div className="mx-auto flex w-full max-w-2xl">
          {NAV.map((item) => (
            <NavLink
              key={item.href}
              href={item.href}
              exact={item.exact}
              className="flex min-h-14 flex-1 items-center justify-center text-sm font-semibold text-ink-2"
              activeClassName="text-gold-hover"
            >
              {item.label}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
