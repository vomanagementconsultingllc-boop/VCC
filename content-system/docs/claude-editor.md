# Editing with Claude

Edit jobs can be done by a person in the editor dashboard, or by a Claude
session using an **access key**. A key belongs to one editor seat and can do
exactly what that editor could do in the app: see the jobs assigned to that
seat, download their raw clips, and upload a cut. It cannot see clients, voice
profiles, pricing, or any other editor's jobs. Every cut still goes to
Review, where you or your VA approve it or send a revision note, before the
client sees anything.

## Set up (once)

1. **Settings -> Team and editors**: invite an editor seat for Claude. Use an
   email alias you own, for example `you+claude@yourdomain.com`.
2. **Settings -> Access keys for Claude editing**: pick that seat, create a
   key, and copy it. It is shown once. Revoke it here any time.
3. Give the key to the Claude session as an environment secret named
   `VCC_EDITOR_KEY`, along with the app address as `VCC_APP_URL`. Do not paste
   the key into chat or commit it anywhere.
4. The session needs network access to the app's host and to your Supabase
   project's host (the download and upload links point there).

## Each time

Assign jobs to the Claude seat from **Edit jobs**, then start a Claude session
(or a scheduled one) with a prompt like:

> Check my edit queue at $VCC_APP_URL using the access key in $VCC_EDITOR_KEY.
> For each queued or revision job: start it, read the script, shot list, style
> notes and any revision note, download the clips, edit the video to the
> script, upload the cut and submit it with a note saying what you did.

## The API

All requests send `Authorization: Bearer $VCC_EDITOR_KEY`.

| Request | What it does |
| --- | --- |
| `GET /api/agent/jobs` | Open jobs assigned to this seat. |
| `GET /api/agent/jobs/{id}` | The brief: script, shots, style notes, thread, and a 15-minute download link per raw clip. |
| `POST /api/agent/jobs/{id}` `{"action":"start"}` | Marks the job in progress. |
| `POST /api/agent/jobs/{id}` `{"action":"upload_url","file_name":"cut.mp4"}` | Returns `path` and `upload_url`. |
| `PUT {upload_url}` with the file as the body | Uploads the cut. Send `Content-Type: video/mp4`. |
| `POST /api/agent/jobs/{id}` `{"action":"submit","path":"...","notes":"..."}` | Submits for review. `alt_path` is optional for a second version. |
| `POST /api/agent/jobs/{id}` `{"action":"note","body":"..."}` | Adds a note to the job thread. |

Example:

```bash
curl -s -H "Authorization: Bearer $VCC_EDITOR_KEY" "$VCC_APP_URL/api/agent/jobs"

curl -s -X POST -H "Authorization: Bearer $VCC_EDITOR_KEY" -H "Content-Type: application/json" \
  -d '{"action":"upload_url","file_name":"cut.mp4"}' "$VCC_APP_URL/api/agent/jobs/$JOB_ID"

curl -s -X PUT -H "Content-Type: video/mp4" --data-binary @cut.mp4 "$UPLOAD_URL"
```

## What clients should know

Raw footage for jobs assigned to the Claude seat is downloaded into, and
edited inside, a Claude session. If your client agreement says their footage
is only handled by your team, update it before assigning their jobs to this
seat. Jobs assigned to human editors never go through Claude.

Download links issued through a key are written to the audit log, the same as
links opened by a person.
