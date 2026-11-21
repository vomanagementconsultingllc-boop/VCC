import Link from "next/link";
import type { ReactNode } from "react";
import { TopTabs, topLinkClass } from "@/components/app-nav";

const TABS = [
  { href: "/demo/team", label: "Clients", exact: true },
  { href: "/demo/team/videos", label: "Videos" },
  { href: "/demo/team/research", label: "Research" },
];

/** What you and your team see: the same three-tab bar. */
export default function DemoTeamLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen">
      <TopTabs
        wide
        items={TABS}
        right={
          <Link href="/demo" className={topLinkClass}>
            Demo · client side →
          </Link>
        }
      />
      <main className="mx-auto w-full max-w-[1200px] px-4 pb-20 pt-6 md:px-8">{children}</main>
    </div>
  );
}
