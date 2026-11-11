import type { Metadata } from "next";
import { requireEditor } from "@/lib/auth";
import { EmptyState, PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "My jobs" };

export default async function EditorHome() {
  await requireEditor();
  return (
    <>
      <PageHeader title="My jobs" />
      <EmptyState title="No jobs assigned">New jobs show up here and arrive by email.</EmptyState>
    </>
  );
}
