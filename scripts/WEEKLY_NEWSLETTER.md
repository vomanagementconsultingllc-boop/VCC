# Weekly VCC update newsletter: run book

Nathan's request (Nov 18, 2026): every time he uploads his weekly creative
studio video, turn it into a newsletter and send it the same day. Auto-send,
just ping him.

A scheduled task runs this check every hour from 8 AM to 11 PM Eastern. Each
run is a fresh Claude session with this repo, the Google Drive connector, the
Resend key (injected by the proxy for api.resend.com) and access to discord.com.

## Rules (from Nathan's rule sheets; they win over anything here)

- Read "0 General Rules (read first)" (Google Doc 1sxP91Xt5wa-hbZ0kvvA22kVqJYIEjSN0BpRIyNiw9Lw)
  and the "Story Bank" (Google Doc 14Km-crDRIDq0mwmNV44-8OQDqVtYtcQnCCBirKfgZ1E).
- Only facts from the week's video transcript and the Story Bank. Never invent
  results, numbers, quotes or stories. If a section of the layout isn't covered
  by the video, leave it out (challenge, ask, next and concern are optional).
- Nathan's voice: first person ("I"), plain words, short sentences. No em
  dashes. No hype words ("insane", "game-changer", "unlock").
- Each story card is 1 to 2 sentences. 3 or 4 cards.

## Steps

1. Find the folder named "weekly video" inside Content / Finished
   (Finished folder id 11otGiTOmrneudqWnUOEOpkPhxfByqTXl) with the Drive
   search tool. If it doesn't exist or has no video files, stop: nothing to do.
2. Run `status` (command below). Its `processedFiles` lists every Drive file
   id that already has an issue. The newest video in the folder that is not in
   that list is this week's video. If there is none, stop: nothing to do.
3. Read the video's transcript with the Drive read tool (read_file_content on
   the video's file id returns what he says). If there is no transcript yet,
   stop and let the next hourly run try again.
4. Run `discord` for the current member count. `status` gives last week's
   count (`lastDiscordCount`).
5. Write the issue JSON to a scratch file (format below), then run `preview`
   on it and read the result. Fix anything that breaks the rules above.
6. Run `send` on it. It schedules the broadcast to everyone in the "All prompt
   signups" Resend segment (sendDelayMinutes after now, never later than
   11:45 PM Eastern the same day) and emails Nathan a preview with the send
   time and how to stop it. If something required is missing (for example the
   mailing address), it emails Nathan "[Needs you]" instead and sends nothing.
7. Finish with a 2 to 3 line summary: the video, the subject, when it sends
   (or what's missing).

Commands (run from the repo root):

    export RESEND_API_KEY=proxy-injected NODE_USE_ENV_PROXY=1 NODE_EXTRA_CA_CERTS=/root/.ccr/ca-bundle.crt
    node scripts/weekly-newsletter.js status
    node scripts/weekly-newsletter.js discord
    node scripts/weekly-newsletter.js preview /path/to/issue.json
    node scripts/weekly-newsletter.js send /path/to/issue.json

## Issue JSON

    {
      "driveFileId": "<the weekly video's Drive file id>",
      "date": "Nov 22",
      "summary": { "progress": "main progress, one clause", "concern": "biggest concern (optional)" },
      "metrics": { "prior": <lastDiscordCount>, "current": <discord members now>, "note": "optional" },
      "progress": { "title": "what shipped or what a pilot proved", "cards": ["1-2 sentences", "..."], "screenshots": [] },
      "challenge": { "issue": "optional", "response": "what he's doing about it", "date": "optional" },
      "ask": { "role": "buyer role", "org": "organization", "problem": "specific problem" },
      "howIDidIt": ["how he used his AI systems this week, step by step"],
      "next": "next milestone (optional)",
      "videoUrl": "https://www.instagram.com/growthbynathan/"
    }

Leave out any optional key the video doesn't cover. The ask only appears when
he names who he wants to meet and why.

## Settings

scripts/newsletter.config.json: sender, reply-to, who gets the preview ping,
the Resend segment, the Discord invite, the send delay and the footer's
mailing address (required by law in marketing email; the newsletter won't
send without it).

To stop one issue: delete it at resend.com/broadcasts before its send time.
