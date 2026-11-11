import { SubmitButton } from "@/components/action-form";
import { UploadSlot } from "@/components/upload-slot";
import { Badge, Card, CardTitle } from "@/components/ui";
import { acceptFootage, recheckFootage, requestReshoot } from "@/app/actions/footage";
import { FLAG_LABEL, describeFlag } from "@/lib/footage/checks";
import { formatDateTime } from "@/lib/labels";
import { formatBytes } from "@/lib/storage";
import type { Database } from "@/lib/database.types";

type Shot = Database["public"]["Tables"]["shots"]["Row"];
type Upload = Database["public"]["Tables"]["footage_uploads"]["Row"];

/** Team view of a script's footage: what came in, what the checks said, and overrides. */
export function FootageCard({ shots, uploads, canUpload }: { shots: Shot[]; uploads: Upload[]; canUpload: boolean }) {
  return (
    <Card>
      <CardTitle>Footage</CardTitle>
      <p className="mb-4 text-sm text-ink-2">
        One slot per shot. Links to clips expire after 15 minutes and every one is logged.
      </p>
      <ol className="space-y-4">
        {shots.map((shot) => {
          const upload = uploads.find((u) => u.shot_id === shot.id && !u.superseded);
          const earlier = uploads.filter((u) => u.shot_id === shot.id && u.superseded).length;
          const requirement = { orientation: shot.orientation, minDurationSeconds: shot.min_duration_seconds };
          return (
            <li key={shot.id} className="rounded-lg border border-line p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-semibold text-ink">
                  Shot {shot.shot_number}
                  {shot.instruction ? `: ${shot.instruction}` : ""}
                </span>
                {upload ? (
                  <Badge
                    tone={upload.check_status === "passed" ? "success" : upload.check_status === "failed" ? "danger" : "info"}
                  >
                    {upload.check_status === "passed" ? "Passed" : upload.check_status === "failed" ? "Failed" : "Checking"}
                  </Badge>
                ) : (
                  <Badge>Nothing yet</Badge>
                )}
              </div>
              {upload && (
                <div className="mt-2 text-sm text-ink-2">
                  <p>
                    {upload.original_name || "clip"} · {formatBytes(upload.size_bytes)}
                    {upload.duration_seconds != null && ` · ${Math.round(upload.duration_seconds)}s`}
                    {upload.width && upload.height ? ` · ${upload.width}×${upload.height}` : ""} · uploaded{" "}
                    {formatDateTime(upload.uploaded_at)}
                    {earlier > 0 && ` · ${earlier} earlier take${earlier > 1 ? "s" : ""}`}
                  </p>
                  {upload.flags.length > 0 && (
                    <ul className="mt-1 text-danger">
                      {upload.flags.map((flag) => (
                        <li key={flag}>
                          <strong>{FLAG_LABEL[flag] ?? flag}.</strong>{" "}
                          {describeFlag(flag, requirement, { durationSeconds: upload.duration_seconds })}
                        </li>
                      ))}
                    </ul>
                  )}
                  <div className="mt-3 flex flex-wrap gap-2">
                    <a
                      href={`/api/media/footage/${upload.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex min-h-11 items-center rounded-lg border border-line-strong px-4 text-sm font-semibold text-ink hover:bg-surface-2"
                    >
                      Watch clip
                    </a>
                    {upload.check_status !== "passed" && (
                      <form action={acceptFootage}>
                        <input type="hidden" name="upload_id" value={upload.id} />
                        <SubmitButton variant="secondary">Accept anyway</SubmitButton>
                      </form>
                    )}
                    {!upload.flags.includes("reshoot_requested") && (
                      <form action={requestReshoot}>
                        <input type="hidden" name="upload_id" value={upload.id} />
                        <SubmitButton variant="secondary" confirm="Ask the client to record this shot again?">
                          Ask for a reshoot
                        </SubmitButton>
                      </form>
                    )}
                    {upload.check_status === "pending" && (
                      <form action={recheckFootage}>
                        <input type="hidden" name="upload_id" value={upload.id} />
                        <SubmitButton variant="ghost" pendingLabel="Checking…">
                          Run check now
                        </SubmitButton>
                      </form>
                    )}
                  </div>
                </div>
              )}
              {canUpload && (
                <UploadSlot
                  shot={{
                    id: shot.id,
                    number: shot.shot_number,
                    orientation: shot.orientation,
                    minDurationSeconds: shot.min_duration_seconds,
                  }}
                  current={null}
                  canUpload
                />
              )}
            </li>
          );
        })}
      </ol>
    </Card>
  );
}
