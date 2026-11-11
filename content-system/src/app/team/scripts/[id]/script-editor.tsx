"use client";

import { useMemo, useState, useTransition } from "react";
import { Teleprompter } from "@/components/teleprompter";
import { Button, Card, CardTitle, Field, Input, Select, Textarea, inputClass } from "@/components/ui";
import { FORMATS, type VideoFormat } from "@/lib/labels";
import { findNeverSay, formatDuration, speakingSeconds } from "@/lib/voice";
import type { ActionState } from "@/lib/forms";
import { saveScript, type ScriptInput } from "../actions";

type Shot = ScriptInput["shots"][number] & { key: string };

export type EditorScript = Omit<ScriptInput, "shots"> & { shots: ScriptInput["shots"] };

let keySeed = 0;
const nextKey = () => `new-${++keySeed}`;

const blankShot = (): Shot => ({
  key: nextKey(),
  instruction: "",
  lines: "",
  framing: "",
  orientation: "portrait",
  minDuration: 5,
  whereToLook: "",
  lightingNotes: "",
});

/**
 * The script editor: words, shot list builder, shooting brief and internal
 * notes, saved together. Checks the text against the client's never-say list
 * as you type and previews it in the teleprompter.
 */
export function ScriptEditor({ initial, neverSay }: { initial: EditorScript; neverSay: string[] }) {
  const [title, setTitle] = useState(initial.title);
  const [hook, setHook] = useState(initial.hook);
  const [body, setBody] = useState(initial.body);
  const [format, setFormat] = useState<VideoFormat>(initial.format);
  const [internalNotes, setInternalNotes] = useState(initial.internalNotes);
  const [styleNotes, setStyleNotes] = useState(initial.styleNotes);
  const [referenceUrl, setReferenceUrl] = useState(initial.referenceUrl);
  const [briefNotes, setBriefNotes] = useState(initial.briefNotes);
  const [dueDate, setDueDate] = useState(initial.dueDate ?? "");
  const [shots, setShots] = useState<Shot[]>(() => initial.shots.map((s) => ({ ...s, key: s.id ?? nextKey() })));
  const [result, setResult] = useState<ActionState>(null);
  const [dirty, setDirty] = useState(false);
  const [pending, startTransition] = useTransition();

  const touch = <T,>(setter: (value: T) => void) => (value: T) => {
    setter(value);
    setDirty(true);
    setResult(null);
  };

  const spoken = [hook, body].filter((part) => part.trim()).join("\n\n");
  const violations = useMemo(() => findNeverSay(spoken, neverSay), [spoken, neverSay]);
  const seconds = speakingSeconds(spoken);

  const updateShot = (key: string, patch: Partial<Shot>) => {
    setShots((list) => list.map((s) => (s.key === key ? { ...s, ...patch } : s)));
    setDirty(true);
    setResult(null);
  };
  const moveShot = (index: number, delta: number) => {
    setShots((list) => {
      const target = index + delta;
      if (target < 0 || target >= list.length) return list;
      const copy = [...list];
      [copy[index], copy[target]] = [copy[target], copy[index]];
      return copy;
    });
    setDirty(true);
  };

  const save = () => {
    startTransition(async () => {
      const response = await saveScript({
        id: initial.id,
        title,
        hook,
        body,
        format,
        internalNotes,
        styleNotes,
        referenceUrl,
        briefNotes,
        dueDate: dueDate || null,
        shots: shots.map((s) => ({
          id: s.id,
          instruction: s.instruction,
          lines: s.lines,
          framing: s.framing,
          orientation: s.orientation,
          minDuration: Number.isFinite(s.minDuration) ? s.minDuration : 0,
          whereToLook: s.whereToLook,
          lightingNotes: s.lightingNotes,
        })),
      });
      setResult(response);
      if (response?.ok) setDirty(false);
    });
  };

  return (
    <div className="space-y-5">
      <Card>
        <CardTitle>Script</CardTitle>
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Title" className="sm:col-span-2">
              <Input value={title} onChange={(e) => touch(setTitle)(e.target.value)} name="title" />
            </Field>
            <Field label="Format">
              <Select value={format} onChange={(e) => touch(setFormat)(e.target.value as VideoFormat)} name="format">
                {Object.entries(FORMATS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <Field label="Hook" hint="The first sentence they say, or the text on screen in the first two seconds.">
            <Textarea
              name="hook"
              rows={2}
              className="min-h-0"
              value={hook}
              onChange={(e) => touch(setHook)(e.target.value)}
            />
          </Field>
          <Field
            label="Script"
            hint={`Spoken word, short sentences. About ${formatDuration(seconds)} read aloud.`}
          >
            <Textarea name="body" rows={12} value={body} onChange={(e) => touch(setBody)(e.target.value)} />
          </Field>
          {violations.length > 0 && (
            <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">
              Uses words this client never says: <strong>{violations.join(", ")}</strong>. Reword before sending.
            </p>
          )}
        </div>
      </Card>

      <Card>
        <CardTitle
          action={
            <Button type="button" variant="secondary" onClick={() => touch(setShots)([...shots, blankShot()])}>
              Add shot
            </Button>
          }
        >
          Shot list
        </CardTitle>
        <p className="mb-4 text-sm text-ink-2">
          Each shot becomes one upload slot for the client, labelled with its number and instruction.
        </p>
        {shots.length === 0 && (
          <p className="rounded-lg border border-dashed border-line-strong px-4 py-6 text-center text-sm text-ink-2">
            No shots yet. A script needs at least one before it can be sent.
          </p>
        )}
        <ol className="space-y-4">
          {shots.map((shot, index) => (
            <li key={shot.key} className="rounded-lg border border-line p-4" data-testid="shot">
              <div className="mb-3 flex items-center justify-between gap-2">
                <span className="font-semibold text-ink">Shot {index + 1}</span>
                <span className="flex gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    aria-label={`Move shot ${index + 1} up`}
                    disabled={index === 0}
                    onClick={() => moveShot(index, -1)}
                  >
                    ↑
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    aria-label={`Move shot ${index + 1} down`}
                    disabled={index === shots.length - 1}
                    onClick={() => moveShot(index, 1)}
                  >
                    ↓
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => touch(setShots)(shots.filter((s) => s.key !== shot.key))}
                  >
                    Remove
                  </Button>
                </span>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="One-line instruction" hint="Shown on the upload slot." className="sm:col-span-2">
                  <Input
                    value={shot.instruction}
                    placeholder="Talk to the camera at your front desk"
                    onChange={(e) => updateShot(shot.key, { instruction: e.target.value })}
                  />
                </Field>
                <Field label="What they say in this shot" className="sm:col-span-2">
                  <Textarea
                    rows={2}
                    className="min-h-0"
                    value={shot.lines}
                    onChange={(e) => updateShot(shot.key, { lines: e.target.value })}
                  />
                </Field>
                <Field label="Framing">
                  <Input
                    value={shot.framing}
                    placeholder="Chest up, phone at eye level"
                    onChange={(e) => updateShot(shot.key, { framing: e.target.value })}
                  />
                </Field>
                <Field label="Where to look">
                  <Input
                    value={shot.whereToLook}
                    placeholder="Straight into the lens"
                    onChange={(e) => updateShot(shot.key, { whereToLook: e.target.value })}
                  />
                </Field>
                <Field label="Lighting">
                  <Input
                    value={shot.lightingNotes}
                    placeholder="Face the window"
                    onChange={(e) => updateShot(shot.key, { lightingNotes: e.target.value })}
                  />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Orientation">
                    <Select
                      value={shot.orientation}
                      onChange={(e) =>
                        updateShot(shot.key, { orientation: e.target.value as Shot["orientation"] })
                      }
                    >
                      <option value="portrait">Portrait</option>
                      <option value="landscape">Landscape</option>
                    </Select>
                  </Field>
                  <Field label="Min. seconds">
                    <input
                      type="number"
                      min={0}
                      max={600}
                      className={inputClass}
                      value={Number.isFinite(shot.minDuration) ? shot.minDuration : ""}
                      onChange={(e) => updateShot(shot.key, { minDuration: e.target.valueAsNumber })}
                    />
                  </Field>
                </div>
              </div>
            </li>
          ))}
        </ol>
      </Card>

      <Card>
        <CardTitle>Shooting brief</CardTitle>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Example reference link" hint="A video that shows the look to aim for.">
            <Input
              type="url"
              value={referenceUrl}
              placeholder="https://"
              onChange={(e) => touch(setReferenceUrl)(e.target.value)}
            />
          </Field>
          <Field label="Footage due">
            <Input type="date" value={dueDate} onChange={(e) => touch(setDueDate)(e.target.value)} />
          </Field>
          <Field label="Notes for the client" className="sm:col-span-2">
            <Textarea
              value={briefNotes}
              placeholder="Wear what you would wear to work. Record somewhere quiet."
              onChange={(e) => touch(setBriefNotes)(e.target.value)}
            />
          </Field>
        </div>
      </Card>

      <Card>
        <CardTitle>Team only</CardTitle>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Internal notes" hint="The client never sees these.">
            <Textarea value={internalNotes} onChange={(e) => touch(setInternalNotes)(e.target.value)} />
          </Field>
          <Field label="Style notes for the editor" hint="Sent to the editor with the footage.">
            <Textarea value={styleNotes} onChange={(e) => touch(setStyleNotes)(e.target.value)} />
          </Field>
        </div>
      </Card>

      <Card>
        <CardTitle>Teleprompter preview</CardTitle>
        <Teleprompter text={spoken} />
      </Card>

      <div className="sticky bottom-0 z-10 -mx-4 flex flex-wrap items-center gap-3 border-t border-line bg-surface px-4 py-3">
        <Button type="button" onClick={save} disabled={pending}>
          {pending ? "Saving…" : "Save script"}
        </Button>
        {dirty && !pending && <span className="text-sm text-warning">Unsaved changes</span>}
        {result?.error && (
          <span role="alert" className="text-sm text-danger">
            {result.error}
          </span>
        )}
        {result?.ok && !dirty && (
          <span role="status" className="text-sm text-success">
            {result.ok}
          </span>
        )}
      </div>
    </div>
  );
}
