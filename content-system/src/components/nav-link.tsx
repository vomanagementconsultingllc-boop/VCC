"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { cn } from "@/components/ui";

/** Nav link that highlights itself when its section is open. */
export function NavLink({
  href,
  exact = false,
  children,
  className,
  activeClassName,
}: {
  href: string;
  exact?: boolean;
  children: ReactNode;
  className?: string;
  activeClassName?: string;
}) {
  const pathname = usePathname();
  const active = exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
  return (
    <Link href={href} aria-current={active ? "page" : undefined} className={cn(className, active && activeClassName)}>
      {children}
    </Link>
  );
}
