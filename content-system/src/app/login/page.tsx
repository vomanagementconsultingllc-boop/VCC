import type { Metadata } from "next";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { Field, Input } from "@/components/ui";
import { requestSignInLink } from "./actions";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm rounded-2xl border border-line bg-surface p-7">
        <p className="text-xs font-semibold uppercase tracking-widest text-gold">Vo Creative Co.</p>
        <h1 className="mt-2 font-display text-3xl text-ink">Sign in</h1>
        <p className="mt-2 text-sm text-ink-2">
          Enter your email and we will send you a link. No password to remember.
        </p>
        <ActionForm action={requestSignInLink} className="mt-6 space-y-4">
          <Field label="Email">
            <Input
              type="email"
              name="email"
              required
              autoComplete="email"
              inputMode="email"
              autoCapitalize="none"
              placeholder="you@business.com"
            />
          </Field>
          <SubmitButton pendingLabel="Sending…" className="w-full">
            Email me a sign-in link
          </SubmitButton>
        </ActionForm>
      </div>
    </main>
  );
}
