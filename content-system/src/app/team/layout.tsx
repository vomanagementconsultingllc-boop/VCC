import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { requireStaff } from "@/lib/auth";
import { TopTabs, topLinkClass } from "@/components/app-nav";
import { SignOutButton } from "@/components/sign-out";
import { PageLoading } from "@/components/ui";

// Three tabs, like the client side. Everything else is reached from inside
// one of them: a client's pages from Clients, the editing queue from Videos,
// the hook library from Research.
const TABS = [
  { href: "/team", label: "Clients", exact: true },
  { href: "/team/videos", label: "Videos" },
  { href: "/team/research", label: "Research" },
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
  return (
    <div className="min-h-screen">
      <TopTabs
        wide
        items={TABS}
        right={
          <>
            {user.role === "admin" && (
              <Link href="/team/settings" className={topLinkClass}>
                Settings
              </Link>
            )}
            <SignOutButton className={topLinkClass} />
          </>
        }
      />
      <main className="mx-auto w-full max-w-[1200px] px-4 pb-20 pt-6 md:px-8">{children}</main>
    </div>
  );
}
