"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { beginBrollUpload, completeBrollUpload } from "@/app/actions/broll";
import { createClient } from "@/lib/supabase/browser";
import { uploadFile } from "@/lib/resumable-upload";
import { extractFrames } from "@/lib/video-frames";
import { BROLL_FRAMES } from "@/lib/storage";
import { Badge, buttonClass, cn } from "@/components/ui";

export type BrollState = { status: "pending" | "passed" | "failed"; advice: string } | null;

/**
 * The submission box for one b-roll item. Tap, record or pick a clip, and it
 * uploads and is reviewed straight away. If the clip is not usable the box
 * shows what to change and asks for another.
 */
export function BrollSlot({ requestId, current, canSubmit }: { requestId: string; current: BrollState; canSubmit: boolean }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fresh, setFresh] = useState<BrollState>(null);
  const shown = fresh ?? current;
  const busy = progress !== null;

  async function submit(file: File | undefined) {
    if (!file) return;
    setError(null);
    setFresh(null);
    try {
      setProgress("Getting your clip ready…");
      const frames = await extractFrames(file, BROLL_FRAMES);
      const ticket = await beginBrollUpload({
        requestId,
        fileName: file.name,
        sizeBytes: file.size,
        frameCount: frames.length,
      });
      if ("error" in ticket) throw new Error(ticket.error);

      // Frames are small: plain uploads. Storage policy only accepts them in this client's own box.
      const supabase = createClient();
      const framePaths: string[] = [];
      for (const [i, frame] of frames.entries()) {
        const { error: frameError } = await supabase.storage
          .from(ticket.bucket)
          .upload(ticket.framePaths[i], frame, { contentType: "image/jpeg" });
        if (!frameError) framePaths.push(ticket.framePaths[i]);
      }

      await uploadFile(file, ticket, (percent) => setProgress(`Uploading ${percent}%. Keep this page open.`));
      setProgress("Uploaded. Checking your clip…");
      const result = await completeBrollUpload({
        submissionId: ticket.submissionId,
        requestId,
        path: ticket.path,
        framePaths,
        fileName: file.name,
        sizeBytes: file.size,
      });
      if ("error" in result) throw new Error(result.error);
      setFresh(result);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setProgress(null);
    }
  }

  return (
    <div className="mt-4 rounded-lg bg-surface-2 p-3" data-testid="broll-slot">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-semibold text-ink">Your clip</span>
        {!busy && shown?.status === "passed" && <Badge tone="success">Accepted</Badge>}
        {!busy && shown?.status === "pending" && <Badge tone="info">Received, being reviewed</Badge>}
        {!busy && shown?.status === "failed" && <Badge tone="danger">Please send another</Badge>}
        {!busy && !shown && <Badge>Not sent yet</Badge>}
      </div>

      {!busy && shown?.status === "failed" && shown.advice && (
        <div className="mt-2 rounded-lg bg-warning-soft px-3 py-2 text-sm text-ink" role="alert">
          <p className="font-semibold">What to change</p>
          <p className="mt-1 whitespace-pre-wrap">{shown.advice}</p>
        </div>
      )}
      {!busy && shown?.status === "passed" && (
        <p className="mt-2 text-sm text-ink-2">This one is done. Thank you.</p>
      )}
      {!busy && shown?.status === "pending" && (
        <p className="mt-2 text-sm text-ink-2">We have your clip and will let you know if we need another take.</p>
      )}

      {busy && (
        <p className="mt-3 text-sm text-ink-2" role="status">
          {progress}
        </p>
      )}
      {error && (
        <p className="mt-2 text-sm text-danger" role="alert">
          {error}
        </p>
      )}

      {canSubmit && !busy && shown?.status !== "passed" && (
        <>
          <button
            type="button"
            className={cn(buttonClass(shown?.status === "pending" ? "secondary" : "primary"), "mt-3 w-full")}
            onClick={() => inputRef.current?.click()}
          >
            {shown?.status === "failed" ? "Record and send another" : shown ? "Send a different clip" : "Record or choose video"}
          </button>
          <input
            ref={inputRef}
            type="file"
            accept="video/*"
            className="sr-only"
            tabIndex={-1}
            aria-label="Video file"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              void submit(file);
            }}
          />
        </>
      )}
    </div>
  );
}
