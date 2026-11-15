import type { Metadata } from "next";
import { publicEnv } from "@/lib/env";
import { Eyebrow } from "@/components/ui";
import { LoginForm } from "./login-form";
import { Logo } from "@/components/logo";

export const metadata: Metadata = { title: "Client sign in" };

const STEPS = [
  { title: "Read and approve your script", detail: "Written in your words. One tap to approve, or tell us what to change." },
  { title: "Record with the teleprompter", detail: "Your script scrolls on screen. Upload one clip per shot, straight from your phone." },
  { title: "Download your finished video", detail: "Edited and ready to post, with a caption to go with it." },
];

/**
 * Sign-in page. Written for clients (they are most of the people who see
 * it, usually on a phone), but team members and editors sign in here too:
 * everyone lands in their own area afterwards.
 */
export default function LoginPage() {
  return (
    <main className="flex flex-1 flex-col lg:flex-row">
      <section className="bg-ink px-6 py-8 text-white lg:flex lg:w-1/2 lg:flex-col lg:justify-between lg:px-14 lg:py-14">
        <Logo tone="gold" size="lg" />
        <div className="mt-6 lg:mt-0">
          <h1 className="font-display text-3xl leading-tight sm:text-4xl lg:text-5xl">
            Your scripts, shoots and finished videos, in one place.
          </h1>
          <ol className="mt-8 hidden space-y-5 lg:block">
            {STEPS.map((step, i) => (
              <li key={step.title} className="flex gap-4">
                <span
                  aria-hidden
                  className="flex size-8 shrink-0 items-center justify-center rounded-full border border-gold-soft/60 text-sm font-semibold text-gold-soft"
                >
                  {i + 1}
                </span>
                <span>
                  <span className="block font-semibold">{step.title}</span>
                  <span className="block text-sm text-white/70">{step.detail}</span>
                </span>
              </li>
            ))}
          </ol>
        </div>
        <p className="mt-8 hidden text-sm text-white/60 lg:block">
          Private to you. Only you and our team can see your scripts and footage.
        </p>
      </section>

      <section className="flex flex-1 items-start justify-center bg-surface px-6 py-10 lg:items-center lg:px-14">
        <div className="w-full max-w-sm">
          <Eyebrow>Client portal</Eyebrow>
          <h2 className="mt-2 font-display text-4xl text-ink">Sign in</h2>
          <p className="mb-6 mt-2 text-ink-2">Enter your email and we will send you a link to sign in.</p>
          <LoginForm supportEmail={publicEnv.supportEmail} />

          <ol className="mt-10 space-y-4 border-t border-line pt-8 lg:hidden">
            {STEPS.map((step, i) => (
              <li key={step.title} className="flex gap-3">
                <span
                  aria-hidden
                  className="flex size-7 shrink-0 items-center justify-center rounded-full bg-gold-soft text-sm font-semibold text-gold-hover"
                >
                  {i + 1}
                </span>
                <span>
                  <span className="block text-sm font-semibold text-ink">{step.title}</span>
                  <span className="block text-sm text-ink-2">{step.detail}</span>
                </span>
              </li>
            ))}
          </ol>
          <p className="mt-8 text-xs text-ink-3">
            Private to you. Only you and our team can see your scripts and footage. Team members and editors sign in
            here too.
          </p>
        </div>
      </section>
    </main>
  );
}
