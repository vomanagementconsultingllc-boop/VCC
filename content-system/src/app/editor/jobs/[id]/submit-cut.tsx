"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { beginCutUpload, submitCut } from "@/app/actions/jobs";
import { uploadFile } from "@/lib/resumable-upload";
import { Button, Field, Textarea, inputClass } from "@/components/ui";

/** Upload the finished cut (and an optional second version) with notes, then submit for review. */
export function SubmitCut({ jobId }: { jobId: string }) {
  const router = useRouter();
  const [main, setMain] = useState<File | null>(null);
  const [alt, setAlt] = useState<File | null>(null);
  const [notes, setNotes] = useState("");
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function send(file: File, label: string): Promise<string> {
    const ticket = await beginCutUpload({ jobId, fileName: file.name, sizeBytes: file.size });
    if ("error" in ticket) throw new Error(ticket.error);
    await uploadFile(file, ticket, (percent) => setProgress(`Uploading ${label}: ${percent}%`));
    return ticket.path;
  }

  async function submit() {
    if (!main) {
      setError("Choose the finished cut first.");
      return;
    }
    setError(null);
    try {
      const path = await send(main, "finished cut");
      const altPath = alt ? await send(alt, "second version") : null;
      setProgress("Submitting…");
      const result = await submitCut({ jobId, path, altPath, notes });
      if (result?.error) throw new Error(result.error);
      setProgress(null);
      router.refresh();
    } catch (err) {
      setProgress(null);
      setError(err instanceof Error ? `${err.message} Press submit to try again.` : "Something went wrong. Try again.");
    }
  }

  const busy = progress !== null;
  return (
    <div className="space-y-4">
      <Field label="Finished cut">
        <input
          type="file"
          accept="video/*"
          className={inputClass}
          disabled={busy}
          onChange={(e) => setMain(e.target.files?.[0] ?? null)}
        />
      </Field>
      <Field label="Second version (optional)" hint="An alternate cut, hook or caption style.">
        <input
          type="file"
          accept="video/*"
          className={inputClass}
          disabled={busy}
          onChange={(e) => setAlt(e.target.files?.[0] ?? null)}
        />
      </Field>
      <Field label="Notes for the team">
        <Textarea value={notes} disabled={busy} onChange={(e) => setNotes(e.target.value)} />
      </Field>
      <Button type="button" onClick={submit} disabled={busy}>
        {busy ? progress : "Submit for review"}
      </Button>
      {error && (
        <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
