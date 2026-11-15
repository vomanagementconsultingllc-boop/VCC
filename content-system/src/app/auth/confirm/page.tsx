import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { Guide } from "@/components/guide";
import { Logo } from "@/components/logo";
import { confirmSignIn } from "./actions";

export const metadata: Metadata = { title: "Confirm sign-in" };

/**
 * Landing page for the emailed link. The token is only spent when the person
 * taps the button, because mail scanners and link previews open links
 * automatically and would otherwise use it up before the person gets here.
 */
export default function ConfirmPage({ searchParams }: PageProps<"/auth/confirm">) {
  return (
    <main className="flex flex-1 flex-col items-center px-4 pb-12 pt-8">
      <Logo size="lg" />
      <div className="mt-10 w-full max-w-sm">
        <Guide mood="cheer" size={92}>
          There you are. One more tap and you&rsquo;re in.
        </Guide>
        <div className="panel mt-4 border border-ink/10 p-6">
          <Suspense fallback={<p className="text-sm text-ink-2">Loading…</p>}>
            <ConfirmForm searchParams={searchParams} />
          </Suspense>
        </div>
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
      <p className="text-sm text-ink-2">
        This link is incomplete.{" "}
        <Link href="/login" className="font-semibold text-ink underline">
          Ask for a new one
        </Link>
        .
      </p>
    );
  }

  return (
    <ActionForm action={confirmSignIn}>
      <input type="hidden" name="token_hash" value={tokenHash} />
      <input type="hidden" name="type" value={type} />
      <SubmitButton pendingLabel="Signing in…" className="w-full">
        Sign in
      </SubmitButton>
    </ActionForm>
  );
}
