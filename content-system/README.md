# Done-With-You Content System

Web app for Vo Creative Co. that runs the done-with-you content offer end to
end: research proven hooks, write scripts in each client's voice, send
shooting instructions, collect phone footage and b-roll, route it to editors,
deliver finished videos, and track what went out.

Stack: Next.js (App Router, TypeScript), Supabase (Postgres with row level
security, auth, private storage), Tailwind, Resend for email, Inngest for
scheduled jobs, Apify for research, the Anthropic API for drafting and b-roll
review. Built to deploy on Vercel.

This folder is a separate app from the marketing site in the repo root. The
root `netlify.toml` removes it from the published marketing site.

## What a client sees: three steps

The client side is three steps and nothing else, guided by one cartoon
character ("Reel", drawn once in `src/components/guide.tsx`) who talks in
speech bubbles.

1. **Plan.** On first sign-in Reel asks a questionnaire: the business, what
   to research, and in detail where they can film and what they film with.
   After that, each week's videos appear here, each with its hook and a
   direct link to the video it is modelled on. The client reads their
   version and says yes or asks for changes.
2. **Shoot.** Directions shot by shot (built around the places from the
   questionnaire), the teleprompter, one upload box per shot, and the extra
   b-roll clips. Each clip is checked as it lands and Reel says what to redo.
3. **Finish.** The edit comes back. The client watches it, sends it back
   with what to fix or approves it, then downloads one or all.

The team plans a client's week with one button on their Scripts tab: seven
drafts from the best proven hooks that client has not used, each carrying
its inspiration link through to the client, the editor and the Claude
editing API.

## Who can see what

Enforced in the database (row level security), not just in the app:

| Role | Sees |
| --- | --- |
| Admin | Everything, including pricing, costs, settings, the audit log, export and delete. |
| Team member | Clients, voice profiles, research, scripts, pipeline, jobs. No pricing, costs, settings or audit log. |
| Editor | Only jobs assigned to them, and through an open job that script, its shots and clips, and the client's accepted b-roll. Access ends when the job is done. |
| Client | Only their own scripts (once sent), briefs, upload slots, b-roll list, delivered videos and voice summary. Never research, internal notes or other clients. |

Media lives in private buckets and is only served through signed links that
expire after 15 minutes. Every link issued is written to the audit log.

## Set up

1. **Supabase.** Create a project. In `supabase/`, link it and push the
   schema: `npx supabase link` then `npx supabase db push`. A paid plan is
   needed for phone footage (the free plan caps files at 50 MB); raise the
   upload limit in Storage settings.
2. **Auth settings** (Supabase dashboard, Authentication):
   - turn **off** "Allow new users to sign up" (accounts are invite-only)
   - set the Site URL to this app's address
   - set the Magic Link and Invite email templates to the two files in
     `supabase/templates/` (they link to `/auth/confirm`)
   - add custom SMTP (Resend works) so sign-in emails are delivered reliably
3. **Environment.** Copy `.env.example` to `.env.local` (and into Vercel).
   Only the three Supabase values and the site URL are required to start.
4. **First admin.** `npm run bootstrap-admin -- you@example.com "Your Name"`,
   then sign in at `/login`. Invite everyone else from Settings and from each
   client's page.
5. **Scheduled jobs.** Connect Inngest to `/api/inngest`. It sends queued
   emails every 5 minutes, re-runs unfinished checks, sends footage reminders
   at day 3 and day 6, flags overdue jobs, and pulls research weekly.

Optional keys, each switches on one thing: `RESEND_API_KEY` (emails; without
it they are logged, not sent), `ANTHROPIC_API_KEY` (AI drafting, voice
profiles, b-roll review), `APIFY_TOKEN` (research pulls), `FIREFLIES_API_KEY`
(import the onboarding call).

## Develop

```bash
npm install
npx supabase start        # local Supabase (needs Docker)
npm run dev
npm test                  # database rules and unit tests: no Docker needed
npm run test:api          # real sign-ins against local Supabase
npm run typecheck && npm run lint
npm run db:types          # after changing a migration
```

`npm test` runs every migration on an embedded Postgres and then signs in as
each role to try to reach data it should not have. Two guard tests fail the
build if a new table has no row level security, or is not scoped by
`client_id` without being explicitly listed as shared.

## Decisions on record

- Editors work in the app. One editor seat can be driven by a Claude session
  through an access key: see `docs/claude-editor.md`.
- Two revision rounds are included per video (change it in Settings).
- Research comes from Apify. Only niche keywords are sent to it.
- Performance numbers wait for platform API access. Clients mark a video as
  posted; the views fields exist but nothing fills them yet.

## What AI is sent

Every AI call is logged with the client and a hash of the input (`ai_calls`).

- **Script draft:** the hook, format, phrase bank, never-say list, topics to
  avoid, the client's offer, up to three of their posts, the source video's
  transcript, and the team's brief. Not their name.
- **Voice profile:** the onboarding call transcript.
- **B-roll review:** what the clip was meant to show, and six still frames
  taken from it in the client's browser. Not the video itself.
- **Hook analysis:** a research video's transcript or caption. No client data.

An AI-written script is flagged before its words are saved, and the database
refuses to send it to a client until someone on the team marks it reviewed.

## Not yet run against live services

Built and tested locally, but these integrations have not been exercised
against real accounts. Check each once before relying on it:

- Apify research pull (actor input and output field names)
- Fireflies transcript import
- Resend email delivery and the Inngest schedules
- The Anthropic calls (drafting, voice profile, b-roll review)
- Uploads and signed links against a hosted Supabase project, for steps 3
  onward (`npm run test:api` covers these and needs a running stack)
- The Claude editing API's upload step (`PUT` to the signed upload URL)

## Not built (by design or deferred)

- Posting to social platforms, billing, a public site, a mobile app.
- Transcribing a research video's audio: hooks come from captions or a pasted
  transcript.
- Recording inside the page with the teleprompter over the camera. Clients
  record with their phone camera from the upload button.
- A separate in-portal voice recording. The onboarding call is the interview.
