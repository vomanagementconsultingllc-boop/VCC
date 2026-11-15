import { Suspense, type ReactNode } from "react";
import { requireEditor } from "@/lib/auth";
import { TopNav } from "@/components/app-nav";
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
      <TopNav items={[{ href: "/editor", label: "My jobs" }]} label="Editing" right={<SignOutButton />} />
      <main className="mx-auto w-full max-w-4xl px-4 pb-20 pt-24 sm:pt-28">{children}</main>
    </div>
  );
}
