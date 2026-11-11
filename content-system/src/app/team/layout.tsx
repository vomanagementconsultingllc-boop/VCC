import { Suspense, type ReactNode } from "react";
import { requireStaff } from "@/lib/auth";
import { NavLink } from "@/components/nav-link";
import { SignOutButton } from "@/components/sign-out";
import { PageLoading } from "@/components/ui";

const NAV = [
  { href: "/team", label: "Clients", exact: true, adminOnly: false },
  { href: "/team/pipeline", label: "Pipeline", exact: false, adminOnly: false },
  { href: "/team/jobs", label: "Edit jobs", exact: false, adminOnly: false },
  { href: "/team/settings", label: "Settings", exact: false, adminOnly: true },
];

export default function TeamLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<PageLoading />}>
      <TeamShell>{children}</TeamShell>
    </Suspense>
  );
}

async function TeamShell({ children }: { children: ReactNode }) {
  const user = await requireStaff();
  const items = NAV.filter((item) => !item.adminOnly || user.role === "admin");
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
          <span className="font-display text-lg text-ink">Vo Creative Co.</span>
          <nav className="flex flex-1 flex-wrap gap-1" aria-label="Main">
            {items.map((item) => (
              <NavLink
                key={item.href}
                href={item.href}
                exact={item.exact}
                className="rounded-lg px-3 py-2 text-sm font-semibold text-ink-2 hover:bg-band hover:text-ink"
                activeClassName="bg-gold-soft text-gold-hover"
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
          <div className="flex items-center gap-3 text-sm text-ink-2">
            <span>
              {user.fullName || user.email} · {user.role}
            </span>
            <SignOutButton />
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">{children}</main>
    </div>
  );
}
