import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { confirmSignIn } from "./actions";

export const metadata: Metadata = { title: "Confirm sign-in" };

/**
 * Landing page for the emailed link. The token is only spent when the person
 * taps the button, because mail scanners and link previews open links
 * automatically and would otherwise use it up before the person gets here.
 */
export default function ConfirmPage({ searchParams }: PageProps<"/auth/confirm">) {
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm rounded-2xl border border-line bg-surface p-7">
        <p className="text-xs font-semibold uppercase tracking-widest text-gold">Vo Creative Co.</p>
        <h1 className="mt-2 font-display text-3xl text-ink">Almost there</h1>
        <Suspense fallback={<p className="mt-4 text-sm text-ink-2">Loading…</p>}>
          <ConfirmForm searchParams={searchParams} />
        </Suspense>
      </div>
    </main>
  );
}

async function ConfirmForm({ searchParams }: Pick<PageProps<"/auth/confirm">, "searchParams">) {
  const params = await searchParams;
  const tokenHash = typeof params.token_hash === "string" ? params.token_hash : "";
  const type = typeof params.type === "string" ? params.type : "";

  if (!tokenHash || !type) {
    return (
      <p className="mt-4 text-sm text-ink-2">
        This link is incomplete.{" "}
        <Link href="/login" className="font-semibold text-gold">
          Ask for a new one
        </Link>
        .
      </p>
    );
  }

  return (
    <ActionForm action={confirmSignIn} className="mt-4">
      <p className="mb-5 text-sm text-ink-2">Tap the button to finish signing in on this device.</p>
      <input type="hidden" name="token_hash" value={tokenHash} />
      <input type="hidden" name="type" value={type} />
      <SubmitButton pendingLabel="Signing in…" className="w-full">
        Sign in
      </SubmitButton>
    </ActionForm>
  );
}
