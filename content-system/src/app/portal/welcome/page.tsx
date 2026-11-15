import type { Metadata } from "next";
import { requireClient } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { Guide } from "@/components/guide";
import { Card, Eyebrow, Field, Input, Select, Textarea } from "@/components/ui";
import { INTAKE, type IntakeAnswers } from "@/lib/intake";
import { firstName } from "@/lib/portal";
import { submitIntake } from "../actions";

export const metadata: Metadata = { title: "Welcome" };

/** The first-sign-in questionnaire. Also where a client comes back to change their answers. */
export default async function WelcomePage() {
  const user = await requireClient();
  const supabase = await createClient();
  const { data } = await supabase.from("client_intake").select("answers, completed_at").maybeSingle();
  const answers = (data?.answers ?? {}) as IntakeAnswers;
  const text = (key: string) => {
    const value = answers[key];
    return Array.isArray(value) ? value.join(", ") : (value ?? "");
  };
  const name = firstName(user.fullName);

  return (
    <div className="space-y-6">
      <Guide mood="cheer" size={96}>
        {data?.completed_at
          ? "Here are your answers. Change anything that is different now and I'll plan around it."
          : `Hi${name ? ` ${name}` : ""}, I'm Reel. Before I plan your first week I need to know a few things. It takes about ten minutes, and you only do it once.`}
      </Guide>

      <ActionForm action={submitIntake} className="space-y-6">
        {INTAKE.map((section, index) => (
          <Card key={section.id}>
            <Eyebrow>
              Part {index + 1} of {INTAKE.length}
            </Eyebrow>
            <h2 className="mb-3 mt-1 font-display text-2xl text-ink">{section.title}</h2>
            <Guide mood={index === INTAKE.length - 1 ? "cheer" : "happy"} size={56} className="mb-5">
              {section.says}
            </Guide>
            <div className="space-y-4">
              {section.fields.map((field) => (
                <Field key={field.key} label={field.label + (field.required ? " *" : "")} hint={field.hint}>
                  {field.kind === "long" && (
                    <Textarea name={field.key} defaultValue={text(field.key)} placeholder={field.placeholder} required={field.required} />
                  )}
                  {field.kind === "text" && (
                    <Input name={field.key} defaultValue={text(field.key)} placeholder={field.placeholder} required={field.required} />
                  )}
                  {field.kind === "choice" && (
                    <Select name={field.key} defaultValue={text(field.key)}>
                      <option value="">Choose…</option>
                      {field.options?.map((o) => (
                        <option key={o} value={o}>
                          {o}
                        </option>
                      ))}
                    </Select>
                  )}
                  {field.kind === "multi" && (
                    <span className="flex flex-wrap gap-2">
                      {field.options?.map((o) => (
                        <label
                          key={o}
                          className="flex min-h-11 cursor-pointer items-center gap-2 rounded-full border border-ink/15 px-4 text-sm has-[:checked]:border-ink has-[:checked]:bg-ink has-[:checked]:text-on-gold"
                        >
                          <input
                            type="checkbox"
                            name={field.key}
                            value={o}
                            className="sr-only"
                            defaultChecked={Array.isArray(answers[field.key]) && (answers[field.key] as string[]).includes(o)}
                          />
                          {o}
                        </label>
                      ))}
                    </span>
                  )}
                </Field>
              ))}
            </div>
          </Card>
        ))}
        <SubmitButton pendingLabel="Saving…" className="w-full">
          {data?.completed_at ? "Save my answers" : "Done. Plan my first week"}
        </SubmitButton>
      </ActionForm>
    </div>
  );
}
