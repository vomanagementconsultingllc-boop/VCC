import { Suspense, type ReactNode } from "react";
import { requireEditor } from "@/lib/auth";
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
  const user = await requireEditor();
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex w-full max-w-4xl items-center justify-between gap-4 px-4 py-3">
          <span className="font-display text-lg text-ink">Vo Creative Co. · Editing</span>
          <div className="flex items-center gap-3 text-sm text-ink-2">
            <span>{user.fullName || user.email}</span>
            <SignOutButton />
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-6">{children}</main>
    </div>
  );
}
