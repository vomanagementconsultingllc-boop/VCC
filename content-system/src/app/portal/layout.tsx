import { Suspense, type ReactNode } from "react";
import { requireClient } from "@/lib/auth";
import { BottomNav } from "@/components/app-nav";
import { Logo } from "@/components/logo";
import { PageLoading } from "@/components/ui";

const NAV = [
  { href: "/portal", label: "To do", exact: true },
  { href: "/portal/broll", label: "B-roll" },
  { href: "/portal/delivered", label: "Delivered" },
  { href: "/portal/settings", label: "Settings" },
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
      <header className="mx-auto flex w-full max-w-2xl items-center px-5 pt-6">
        <Logo />
      </header>
      <main className="mx-auto w-full max-w-2xl px-4 pb-32 pt-6">{children}</main>
      <BottomNav items={NAV} />
    </div>
  );
}
