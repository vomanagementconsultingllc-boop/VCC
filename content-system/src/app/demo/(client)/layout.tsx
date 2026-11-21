import Link from "next/link";
import type { ReactNode } from "react";
import { TopTabs, topLinkClass } from "@/components/app-nav";

const STEPS = [
  { href: "/demo", label: "Plan", step: 1, exact: true },
  { href: "/demo/shoot", label: "Shoot", step: 2 },
  { href: "/demo/finish", label: "Finish", step: 3 },
];

/** What a client sees: three tabs and nothing else. */
export default function DemoClientLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen">
      <TopTabs
        items={STEPS}
        right={
          <Link href="/demo/team" className={topLinkClass}>
            Demo · your side →
          </Link>
        }
      />
      <main className="mx-auto w-full max-w-2xl space-y-5 px-4 pb-16 pt-5">{children}</main>
    </div>
  );
}
