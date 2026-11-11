import type { Metadata } from "next";
import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { ClientFields } from "@/components/client-form";
import { Card, PageHeader } from "@/components/ui";
import { createClientRecord } from "../actions";

export const metadata: Metadata = { title: "New client" };

export default async function NewClientPage() {
  await requireStaff();
  const supabase = await createClient();
  const { data: staff } = await supabase
    .from("profiles")
    .select("id, full_name, email")
    .in("role", ["admin", "team"])
    .order("full_name");

  return (
    <>
      <PageHeader
        title="New client"
        subtitle="Logistics only. Their voice comes from the onboarding call, not a form."
        back={{ href: "/team", label: "Clients" }}
      />
      <Card>
        <ActionForm action={createClientRecord}>
          <ClientFields staff={staff ?? []} />
          <div className="mt-5">
            <SubmitButton pendingLabel="Creating…">Create client</SubmitButton>
          </div>
        </ActionForm>
      </Card>
    </>
  );
}
