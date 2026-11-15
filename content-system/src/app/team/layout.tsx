import { Suspense, type ReactNode } from "react";
import { requireStaff } from "@/lib/auth";
import { TopNav } from "@/components/app-nav";
import { SignOutButton } from "@/components/sign-out";
import { PageLoading } from "@/components/ui";

const NAV = [
  { href: "/team", label: "Clients", exact: true, adminOnly: false },
  { href: "/team/pipeline", label: "Pipeline", exact: false, adminOnly: false },
  { href: "/team/research", label: "Research", exact: false, adminOnly: false },
  { href: "/team/hooks", label: "Hooks", exact: false, adminOnly: false },
  { href: "/team/jobs", label: "Edit jobs", exact: false, adminOnly: false },
  { href: "/team/performance", label: "Performance", exact: false, adminOnly: false },
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
    <div className="min-h-screen">
      <TopNav items={items} right={<SignOutButton />} />
      <main className="mx-auto w-full max-w-[1200px] px-4 pb-20 pt-24 md:px-8 sm:pt-28">{children}</main>
    </div>
  );
}
