import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { requireClient } from "@/lib/auth";
import { TopTabs, topLinkClass } from "@/components/app-nav";
import { PageLoading } from "@/components/ui";

// The whole client side is three tabs.
const STEPS = [
  { href: "/portal", label: "Plan", step: 1, exact: true },
  { href: "/portal/shoot", label: "Shoot", step: 2 },
  { href: "/portal/finish", label: "Finish", step: 3 },
];

/** Client portal. Built for the phone the client shoots on; the same on a desktop. */
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
      <TopTabs items={STEPS} />
      <main className="mx-auto w-full max-w-2xl px-4 pb-10 pt-5">{children}</main>
      {/* Kept out of the way on purpose: the top of the screen is only the three steps. */}
      <footer className="mx-auto flex w-full max-w-2xl justify-center px-5 pb-10">
        <Link href="/portal/settings" className={topLinkClass}>
          Settings and sign out
        </Link>
      </footer>
    </div>
  );
}
