import type { Metadata } from "next";
import { requireClient } from "@/lib/auth";
import { EmptyState } from "@/components/ui";

export const metadata: Metadata = { title: "To do" };

export default async function PortalHome() {
  const user = await requireClient();
  return (
    <>
      <h1 className="mb-4 font-display text-3xl text-ink">
        {user.fullName ? `Hi ${user.fullName.split(" ")[0]}` : "Welcome"}
      </h1>
      <EmptyState title="Nothing is waiting on you">
        We will email you as soon as your next script is ready.
      </EmptyState>
    </>
  );
}
