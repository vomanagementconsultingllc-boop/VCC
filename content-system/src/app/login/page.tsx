import type { Metadata } from "next";
import { Guide } from "@/components/guide";
import { Logo } from "@/components/logo";
import { publicEnv } from "@/lib/env";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

const STEPS = ["Plan", "Shoot", "Finish"];

/**
 * Sign-in page. Written for clients (they are most of the people who see
 * it, usually on a phone); team members and editors sign in here too.
 */
export default function LoginPage() {
  return (
    <main className="flex flex-1 flex-col items-center px-4 pb-12 pt-8">
      <Logo size="lg" />
      <div className="mt-10 w-full max-w-sm">
        <Guide mood="happy" size={92}>
          Hi, I&rsquo;m Reel. Pop your email in and I&rsquo;ll send you a link to sign in. No password.
        </Guide>
        <div className="panel mt-4 border border-ink/10 p-6">
          <LoginForm supportEmail={publicEnv.supportEmail} />
        </div>
        <ol className="mt-8 flex items-center justify-center gap-5 text-sm text-ink-2">
          {STEPS.map((step, i) => (
            <li key={step} className="flex items-center gap-2">
              <span className="flex size-6 items-center justify-center rounded-full border border-ink/25 font-mono text-[11px] text-ink">
                {i + 1}
              </span>
              <span className="whitespace-nowrap">{step}</span>
            </li>
          ))}
        </ol>
      </div>
    </main>
  );
}
