import { createClient } from "@/lib/supabase/server";
import { Badge, Card, CardTitle } from "@/components/ui";
import { INTAKE, type IntakeAnswers } from "@/lib/intake";
import { formatDate } from "@/lib/labels";

/** The client's own questionnaire answers: what to research, and where and how they can film. */
export async function IntakeCard({ clientId }: { clientId: string }) {
  const supabase = await createClient();
  const { data } = await supabase.from("client_intake").select("answers, completed_at").eq("client_id", clientId).maybeSingle();
  const answers = (data?.answers ?? {}) as IntakeAnswers;

  return (
    <Card className="lg:col-span-3">
      <CardTitle
        action={
          data?.completed_at ? <Badge>Answered {formatDate(data.completed_at)}</Badge> : <Badge tone="warning">Not answered yet</Badge>
        }
      >
        Questionnaire
      </CardTitle>
      {!data?.completed_at ? (
        <p className="text-sm text-ink-2">
          The client is asked these the first time they sign in. Their search words become this client&rsquo;s niche tags
          if none are set, and their shooting places feed the directions in each script.
        </p>
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          {INTAKE.map((section) => {
            const filled = section.fields.filter((f) => answers[f.key]);
            if (filled.length === 0) return null;
            return (
              <div key={section.id}>
                <h3 className="mb-2 font-mono text-[11px] uppercase tracking-[0.14em] text-ink-2">{section.title}</h3>
                <dl className="space-y-3 text-sm">
                  {filled.map((f) => {
                    const value = answers[f.key];
                    return (
                      <div key={f.key}>
                        <dt className="text-ink-2">{f.label}</dt>
                        <dd className="whitespace-pre-wrap text-ink">{Array.isArray(value) ? value.join(", ") : value}</dd>
                      </div>
                    );
                  })}
                </dl>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
