"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { beginFootageUpload, completeFootageUpload } from "@/app/actions/footage";
import { createResumableUpload, type ResumableUpload } from "@/lib/resumable-upload";
import { Badge, buttonClass, cn } from "@/components/ui";
import { formatBytes } from "@/lib/storage";

export type SlotUpload = {
  status: "pending" | "passed" | "failed";
  problems: string[];
  durationSeconds: number | null;
};

type Phase =
  | { name: "idle" }
  | { name: "warning"; file: File; problems: string[] }
  | { name: "uploading"; percent: number; fileName: string; size: number }
  | { name: "stalled"; percent: number; size: number; message: string }
  | { name: "checking" }
  | { name: "error"; message: string };

type Meta = { duration: number; width: number; height: number };

/**
 * Quick look at the clip in the browser before spending minutes uploading
 * it. The real checks run on the server afterwards; this only catches the
 * obvious (filmed sideways, far too short) while it is cheap to fix.
 */
function readVideoMeta(file: File): Promise<Meta | null> {
  return new Promise((resolve) => {
    const video = document.createElement("video");
    const url = URL.createObjectURL(file);
    const done = (meta: Meta | null) => {
      clearTimeout(timer);
      URL.revokeObjectURL(url);
      resolve(meta);
    };
    const timer = setTimeout(() => done(null), 5000);
    video.preload = "metadata";
    video.muted = true;
    video.onloadedmetadata = () =>
      done({ duration: video.duration, width: video.videoWidth, height: video.videoHeight });
    video.onerror = () => done(null);
    video.src = url;
  });
}

export function precheck(
  meta: Meta | null,
  shot: { orientation: "portrait" | "landscape"; minDurationSeconds: number },
): string[] {
  if (!meta) return [];
  const problems: string[] = [];
  if (meta.width > 0 && meta.height > 0 && meta.width !== meta.height) {
    const actual = meta.height > meta.width ? "portrait" : "landscape";
    if (actual !== shot.orientation) {
      problems.push(
        shot.orientation === "portrait"
          ? "This looks like it was filmed sideways. This shot needs the phone held upright."
          : "This looks like it was filmed upright. This shot needs the phone turned sideways.",
      );
    }
  }
  if (Number.isFinite(meta.duration) && meta.duration + 0.25 < shot.minDurationSeconds) {
    problems.push(
      `This clip is ${Math.round(meta.duration)} seconds. This shot needs at least ${shot.minDurationSeconds}.`,
    );
  }
  return problems;
}

/**
 * One upload slot for one shot. The client taps it, records or picks a clip,
 * and it uploads in chunks that retry on a bad connection. No file naming,
 * no folders: the slot knows which shot it is.
 */
export function UploadSlot({
  shot,
  current,
  canUpload,
}: {
  shot: { id: string; number: number; orientation: "portrait" | "landscape"; minDurationSeconds: number };
  current: SlotUpload | null;
  canUpload: boolean;
}) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>({ name: "idle" });
  const [fresh, setFresh] = useState<SlotUpload | null>(null);
  const uploadRef = useRef<ResumableUpload | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Show the result of an upload made on this screen until the server render catches up.
  const shown = fresh ?? current;
  const busy = phase.name === "uploading" || phase.name === "checking" || phase.name === "stalled";

  async function choose(file: File | undefined) {
    if (!file) return;
    setFresh(null);
    const problems = precheck(await readVideoMeta(file), shot);
    if (problems.length) setPhase({ name: "warning", file, problems });
    else await start(file);
  }

  async function start(file: File) {
    setPhase({ name: "uploading", percent: 0, fileName: file.name, size: file.size });
    const ticket = await beginFootageUpload({ shotId: shot.id, fileName: file.name, sizeBytes: file.size });
    if ("error" in ticket) {
      setPhase({ name: "error", message: ticket.error });
      return;
    }

    const upload = createResumableUpload(
      file,
      { endpoint: ticket.endpoint, bucket: ticket.bucket, path: ticket.path },
      {
        onProgress: (percent) => setPhase({ name: "uploading", percent, fileName: file.name, size: file.size }),
        onStalled: () =>
          setPhase((p) => ({
            name: "stalled",
            percent: p.name === "uploading" ? p.percent : 0,
            size: file.size,
            message: "The connection dropped. Your progress is saved.",
          })),
        onDone: async () => {
          setPhase({ name: "checking" });
          const outcome = await completeFootageUpload({
            uploadId: ticket.uploadId,
            shotId: shot.id,
            path: ticket.path,
            fileName: file.name,
            sizeBytes: file.size,
          });
          uploadRef.current = null;
          if ("error" in outcome) {
            setPhase({ name: "error", message: outcome.error });
            return;
          }
          setFresh({ status: outcome.status, problems: outcome.problems, durationSeconds: null });
          setPhase({ name: "idle" });
          router.refresh();
        },
      },
    );
    uploadRef.current = upload;
    upload.start();
  }

  const pickLabel = shown?.status === "failed" ? "Record this shot again" : shown ? "Replace this clip" : "Record or choose video";

  return (
    <div className="mt-3 rounded-lg bg-surface-2 p-3" data-testid={`slot-${shot.number}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-semibold text-ink">Your clip for shot {shot.number}</span>
        {!busy && shown?.status === "passed" && <Badge tone="success">Looks good</Badge>}
        {!busy && shown?.status === "pending" && <Badge tone="info">Uploaded, checking</Badge>}
        {!busy && shown?.status === "failed" && <Badge tone="danger">Needs a reshoot</Badge>}
        {!busy && !shown && <Badge>Not uploaded yet</Badge>}
      </div>

      {!busy && shown?.status === "failed" && (
        <ul className="mt-2 space-y-1 text-sm text-danger" role="alert">
          {shown.problems.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      )}

      {phase.name === "warning" && (
        <div className="mt-2 rounded-lg bg-warning-soft p-3 text-sm" role="alert">
          <ul className="space-y-1 text-ink">
            {phase.problems.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" className={buttonClass("primary")} onClick={() => inputRef.current?.click()}>
              Choose a different clip
            </button>
            <button type="button" className={buttonClass("ghost")} onClick={() => start(phase.file)}>
              Upload it anyway
            </button>
          </div>
        </div>
      )}

      {(phase.name === "uploading" || phase.name === "stalled") && (
        <div className="mt-3">
          <div
            className="h-3 overflow-hidden rounded-full bg-band"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={phase.percent}
            aria-label={`Uploading shot ${shot.number}`}
          >
            <div className="h-full bg-gold transition-[width]" style={{ width: `${phase.percent}%` }} />
          </div>
          <p className="mt-1 text-sm text-ink-2">
            {phase.name === "uploading"
              ? `Uploading ${phase.percent}% of ${formatBytes(phase.size)}. Keep this page open.`
              : phase.message}
          </p>
          {phase.name === "stalled" && (
            <button
              type="button"
              className={cn(buttonClass("primary"), "mt-2")}
              onClick={() => {
                setPhase({ name: "uploading", percent: phase.percent, fileName: "", size: phase.size });
                uploadRef.current?.start();
              }}
            >
              Resume upload
            </button>
          )}
        </div>
      )}

      {phase.name === "checking" && (
        <p className="mt-3 text-sm text-ink-2" role="status">
          Uploaded. Checking the clip…
        </p>
      )}

      {phase.name === "error" && (
        <p className="mt-2 text-sm text-danger" role="alert">
          {phase.message}
        </p>
      )}

      {canUpload && !busy && phase.name !== "warning" && (
        <button
          type="button"
          className={cn(buttonClass(shown?.status === "passed" ? "secondary" : "primary"), "mt-3 w-full")}
          onClick={() => inputRef.current?.click()}
        >
          {pickLabel}
        </button>
      )}
      {canUpload && (
        <input
          ref={inputRef}
          type="file"
          accept="video/*"
          className="sr-only"
          tabIndex={-1}
          aria-label={`Video file for shot ${shot.number}`}
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            void choose(file);
          }}
        />
      )}
    </div>
  );
}
