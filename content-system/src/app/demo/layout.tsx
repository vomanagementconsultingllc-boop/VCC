import { notFound } from "next/navigation";
import type { ReactNode } from "react";

/**
 * A walk-through with made-up data: no sign-in, no database. Off unless the
 * app is BUILT with DEMO_MODE=1, so it never appears on the real site by
 * accident. The client side lives in (client), the team side in team.
 */
export default function DemoLayout({ children }: { children: ReactNode }) {
  if (process.env.DEMO_MODE !== "1") notFound();
  return children;
}
