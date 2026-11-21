import { Suspense, type ReactNode } from "react";
import { requireEditor } from "@/lib/auth";
import { TopTabs, topLinkClass } from "@/components/app-nav";
import { SignOutButton } from "@/components/sign-out";
import { PageLoading } from "@/components/ui";

export default function EditorLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<PageLoading />}>
      <EditorShell>{children}</EditorShell>
    </Suspense>
  );
}

async function EditorShell({ children }: { children: ReactNode }) {
  await requireEditor();
  return (
    <div className="min-h-screen">
      {/* An editor has one page (their jobs), so there are no tabs to show. */}
      <TopTabs items={[]} label="Editing" right={<SignOutButton className={topLinkClass} />} />
      <main className="mx-auto w-full max-w-4xl px-4 pb-20 pt-6">{children}</main>
    </div>
  );
}
