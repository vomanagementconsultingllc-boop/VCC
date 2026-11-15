import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { requireClient } from "@/lib/auth";
import { BottomNav } from "@/components/app-nav";
import { Logo } from "@/components/logo";
import { PageLoading } from "@/components/ui";

// The whole client side is three steps.
const STEPS = [
  { href: "/portal", label: "Plan", step: 1, exact: true },
  { href: "/portal/shoot", label: "Shoot", step: 2 },
  { href: "/portal/finish", label: "Finish", step: 3 },
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
    <div className="min-h-screen">
      <header className="mx-auto flex w-full max-w-2xl items-center justify-between px-5 pt-6">
        <Logo />
        <Link
          href="/portal/settings"
          className="flex h-11 items-center rounded-full px-3 font-mono text-[11px] uppercase tracking-[0.14em] text-ink-2 hover:text-ink"
        >
          Settings
        </Link>
      </header>
      <main className="mx-auto w-full max-w-2xl px-4 pb-32 pt-5">{children}</main>
      <BottomNav items={STEPS} />
    </div>
  );
}
