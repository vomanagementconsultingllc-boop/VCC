import { Suspense } from "react";
import { redirect } from "next/navigation";
import { homeFor, requireUser } from "@/lib/auth";
import { PageLoading } from "@/components/ui";

/** Front door: send each person to the area for their role. */
export default function Home() {
  return (
    <Suspense fallback={<PageLoading />}>
      <Redirector />
    </Suspense>
  );
}

async function Redirector(): Promise<never> {
  const user = await requireUser();
  redirect(homeFor(user.role));
}
