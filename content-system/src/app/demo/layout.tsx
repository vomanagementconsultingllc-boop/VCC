import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { BottomNav } from "@/components/app-nav";
import { Logo } from "@/components/logo";

/**
 * A walk-through of the client side with made-up data: no sign-in, no
 * database. Off unless the app is BUILT with DEMO_MODE=1, so it never
 * appears on the real site by accident.
 */
const STEPS = [
  { href: "/demo", label: "Plan", step: 1, exact: true },
  { href: "/demo/shoot", label: "Shoot", step: 2 },
  { href: "/demo/finish", label: "Finish", step: 3 },
];

export default function DemoLayout({ children }: { children: ReactNode }) {
  if (process.env.DEMO_MODE !== "1") notFound();
  return (
    <div className="min-h-screen">
      <header className="mx-auto flex w-full max-w-2xl items-center justify-between px-5 pt-6">
        <Logo />
        <span className="rounded-full border border-ink/20 px-3 py-1 font-mono text-[11px] uppercase tracking-[0.14em] text-ink-2">
          Demo · sample data
        </span>
      </header>
      <main className="mx-auto w-full max-w-2xl space-y-5 px-4 pb-32 pt-5">{children}</main>
      <BottomNav items={STEPS} />
    </div>
  );
}
