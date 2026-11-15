import type { Metadata } from "next";
import Link from "next/link";
import { Guide } from "@/components/guide";
import { Eyebrow, buttonClass } from "@/components/ui";
import { firstName, requireOnboardedClient, weekLabel } from "@/lib/portal";

export const metadata: Metadata = { title: "Step 1: Plan" };

/** Step 1. This week's videos: each with its hook and the video it is modelled on. */
export default async function PlanPage() {
  const { user, supabase } = await requireOnboardedClient();
  const { data: scripts } = await supabase
    .from("scripts")
    .select("id, title, hook, stage, inspo_url, week_of, sent_at")
    .order("week_of", { ascending: false, nullsFirst: false })
    .order("sent_at", { ascending: false });

  const toApprove = (scripts ?? []).filter((s) => s.stage === "sent_to_client");
  const toShoot = (scripts ?? []).filter((s) => s.stage === "awaiting_footage").length;
  const name = firstName(user.fullName);

  return (
    <div className="space-y-5">
      <header>
        <Eyebrow>Step 1 of 3</Eyebrow>
        <h1 className="mt-1 font-display text-4xl text-ink">Plan your week</h1>
      </header>

      {toApprove.length > 0 ? (
        <Guide mood="happy">
          {name ? `${name}, ` : ""}I found {toApprove.length === 1 ? "a video" : `${toApprove.length} videos`} for you this
          week. Each one opens with a hook that is already working for someone like you. Watch the inspiration, read
          your version, and say yes to the ones you want to shoot.
        </Guide>
      ) : (
        <Guide mood={toShoot > 0 ? "cheer" : "think"}>
          {toShoot > 0
            ? `All planned. You have ${toShoot} ready to film. Head to step 2.`
            : "I am out finding your next videos. New ones land every week, and I will email you the moment they are here."}
        </Guide>
      )}

      <ol className="space-y-4">
        {toApprove.map((script, index) => (
          <li key={script.id} className="panel border border-ink/10 p-5">
            <Eyebrow className="text-ink-2">
              Video {index + 1} of {toApprove.length}
              {script.week_of ? ` · ${weekLabel(script.week_of)}` : ""}
            </Eyebrow>
            <p className="mt-2 font-display text-2xl leading-snug text-ink">“{script.hook || script.title}”</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link href={`/portal/scripts/${script.id}`} className={buttonClass("primary")}>
                Read my version
              </Link>
              {script.inspo_url && (
                <a href={script.inspo_url} target="_blank" rel="noopener noreferrer" className={buttonClass("secondary")}>
                  Watch the inspiration ↗
                </a>
              )}
            </div>
          </li>
        ))}
      </ol>

      {toApprove.length === 0 && toShoot > 0 && (
        <Link href="/portal/shoot" className={buttonClass("primary", "w-full")}>
          Go to step 2: Shoot
        </Link>
      )}
    </div>
  );
}
