import { cn } from "@/components/ui";

/**
 * The Vo Creative Co. logo. The identity is wordmark-only: the name set in
 * Marcellus with a touch of tracking, the same as on vocreativeco.com.
 */
export function Logo({ tone = "ink", size = "md", className }: { tone?: "ink" | "gold" | "light"; size?: "md" | "lg"; className?: string }) {
  const color = tone === "gold" ? "text-gold-soft" : tone === "light" ? "text-white" : "text-ink";
  return (
    <span
      className={cn("whitespace-nowrap font-display tracking-[0.02em]", size === "lg" ? "text-2xl" : "text-xl", color, className)}
    >
      Vo Creative Co.
    </span>
  );
}
