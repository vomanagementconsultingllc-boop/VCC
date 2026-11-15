import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

type Variant = "primary" | "secondary" | "ghost" | "danger";

const variants: Record<Variant, string> = {
  primary: "bg-gold text-on-gold shadow-button hover:bg-gold-hover",
  secondary: "border border-ink/[0.08] bg-surface text-ink shadow-soft hover:bg-surface-2",
  ghost: "text-ink-2 hover:bg-ink/[0.06] hover:text-ink",
  danger: "bg-danger text-on-gold shadow-button hover:opacity-90",
};

// Pill-shaped, and 44px tall: comfortable to tap on a phone.
const buttonBase =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-5 py-2 text-sm font-semibold transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-50";

export function buttonClass(variant: Variant = "primary", className?: string) {
  return cn(buttonBase, variants[variant], className);
}

export function Button({ variant = "primary", className, ...props }: ComponentProps<"button"> & { variant?: Variant }) {
  return <button className={buttonClass(variant, className)} {...props} />;
}

export function ButtonLink({
  variant = "primary",
  className,
  ...props
}: ComponentProps<typeof Link> & { variant?: Variant }) {
  return <Link className={buttonClass(variant, className)} {...props} />;
}

/** Small monospace label that sits above a heading. */
export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p className={cn("font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-gold-hover", className)}>
      {children}
    </p>
  );
}

export function Card({
  className,
  children,
  flush = false,
}: {
  className?: string;
  children: ReactNode;
  /** No inner padding, for content that runs to the card's edges. */
  flush?: boolean;
}) {
  return (
    <section className={cn("panel border border-ink/[0.06]", !flush && "p-5 sm:p-6", className)}>{children}</section>
  );
}

export function CardTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      <h2 className="font-display text-[22px] leading-tight text-ink">{children}</h2>
      {action}
    </div>
  );
}

export type Tone = "neutral" | "gold" | "success" | "warning" | "danger" | "info";

const tones: Record<Tone, string> = {
  neutral: "bg-ink/[0.06] text-ink-2",
  gold: "bg-gold-soft text-gold-hover",
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
  danger: "bg-danger-soft text-danger",
  info: "bg-info-soft text-info",
};

export function Badge({ tone = "neutral", children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold", tones[tone])}>
      {children}
    </span>
  );
}

export function PageHeader({
  title,
  subtitle,
  actions,
  back,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  back?: { href: string; label: string };
}) {
  return (
    <header className="mb-8">
      {back && (
        <Link
          href={back.href}
          className="mb-3 inline-block font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-ink-2 hover:text-ink"
        >
          ← {back.label}
        </Link>
      )}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="font-display text-4xl leading-[1.05] text-ink sm:text-5xl">{title}</h1>
          {subtitle && <p className="mt-2 max-w-2xl text-[15px] text-ink-2">{subtitle}</p>}
        </div>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </div>
    </header>
  );
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rounded-[24px] border border-dashed border-ink/15 bg-surface/60 px-6 py-12 text-center">
      <p className="font-semibold text-ink">{title}</p>
      {children && <div className="mt-1 text-sm text-ink-2">{children}</div>}
    </div>
  );
}

export const inputClass =
  "block w-full rounded-2xl border border-ink/10 bg-surface px-4 py-2.5 text-ink shadow-soft placeholder:text-ink-3 focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/30";

export function Field({
  label,
  hint,
  children,
  className,
}: {
  label: string;
  hint?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={cn("block", className)}>
      <span className="mb-1.5 block text-sm font-semibold text-ink">{label}</span>
      {children}
      {hint && <span className="mt-1.5 block text-xs text-ink-2">{hint}</span>}
    </label>
  );
}

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input className={cn(inputClass, className)} {...props} />;
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return <textarea className={cn(inputClass, "min-h-24", className)} {...props} />;
}

export function Select({ className, ...props }: ComponentProps<"select">) {
  return <select className={cn(inputClass, className)} {...props} />;
}

export function PageLoading() {
  return (
    <div className="mx-auto w-full max-w-[1200px] px-4 py-24 text-ink-2" role="status">
      Loading…
    </div>
  );
}
