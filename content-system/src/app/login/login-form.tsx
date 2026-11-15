"use client";

import { useActionState, useState } from "react";
import { Field, Input, buttonClass } from "@/components/ui";
import { requestSignInLink } from "./actions";

/**
 * Sign-in form. One field: the email the account was set up with. After
 * sending, the form is replaced by a "check your email" panel so it is
 * obvious what to do next on a phone.
 */
export function LoginForm({ supportEmail }: { supportEmail: string }) {
  const [state, formAction, pending] = useActionState(requestSignInLink, null);
  const [email, setEmail] = useState("");
  const [again, setAgain] = useState(false);
  const sent = Boolean(state?.ok) && !again;

  if (sent) {
    return (
      <div role="status" data-testid="login-sent">
        <div className="mb-4 flex size-12 items-center justify-center rounded-full bg-success-soft text-2xl text-success" aria-hidden>
          ✓
        </div>
        <h2 className="font-display text-2xl text-ink">Check your email</h2>
        <p className="mt-2 text-ink-2">
          If <strong className="text-ink">{email}</strong> has an account, a sign-in link is on its way. Open it on
          this phone or computer and tap <strong className="text-ink">Sign in</strong>.
        </p>
        <ul className="mt-4 space-y-1 text-sm text-ink-2">
          <li>It can take a minute to arrive.</li>
          <li>The link works once and expires after an hour.</li>
          <li>Nothing there? Look in spam or promotions.</li>
        </ul>
        <button type="button" className={`${buttonClass("secondary")} mt-6 w-full`} onClick={() => setAgain(true)}>
          Use a different email or send again
        </button>
      </div>
    );
  }

  return (
    <form
      action={(formData) => {
        setAgain(false);
        formAction(formData);
      }}
      className="space-y-4"
    >
      <Field label="Email" hint="The address we set your account up with.">
        <Input
          type="email"
          name="email"
          required
          autoFocus
          autoComplete="email"
          inputMode="email"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          placeholder="you@yourbusiness.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </Field>
      <button type="submit" disabled={pending} className={`${buttonClass("primary")} w-full`}>
        {pending ? "Sending…" : "Email me a sign-in link"}
      </button>
      {state?.error && (
        <p role="alert" className="rounded-2xl bg-danger-soft px-3 py-2 text-sm text-danger">
          {state.error}
        </p>
      )}
      <p className="text-sm text-ink-2">
        No password to remember. Trouble getting in?{" "}
        <a href={`mailto:${supportEmail}`} className="font-semibold text-gold-hover underline">
          Email {supportEmail}
        </a>
        .
      </p>
    </form>
  );
}
