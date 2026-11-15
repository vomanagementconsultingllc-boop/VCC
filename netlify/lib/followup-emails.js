// Follow-up emails after someone answers the 4 questions on vocreativeco.com/studio.
// One 5-email track per answer to "What are you struggling with most right now?".
// Goal: stay in touch. Every email teaches one thing and asks for a reply.
//
// Writing rules: first person, short sentences, no hype. {first} becomes the
// person's first name ("Hey there," style fallback is handled in render()).
// Anything in [FILL IN: ...] must be replaced before that email can be sent;
// render() refuses to build an email that still has one.

const SITE = 'https://vocreativeco.com';

// Days after the person answers the questions.
const DAYS = [1, 3, 6, 10, 14];

const TRACKS = {
  'Knowing what to post': [
    {
      subject: "You don't have a content problem",
      alt: 'Why you never know what to post',
      preview: "You have a research problem. Here's the fix.",
      body: [
        'You told me your biggest struggle is knowing what to post.',
        "Here's the thing I wish someone told me earlier: you don't have a content problem. You have a research problem.",
        'Most people sit down, stare at a blank page and try to invent an idea. I stopped doing that. Now I look at what already worked in my niche in the last 30 days, and I borrow the structure, not the content.',
        "That's what the Viral Video Researcher does. It finds the videos that blew past their creator's usual numbers and tells you why they spread.",
        "Over the next two weeks I'll send you a few short emails on how I come up with ideas, step by step.",
        "Quick question: what's your niche? Hit reply and tell me in one line.",
      ],
    },
    {
      subject: 'Pick 3 things to talk about',
      alt: 'The list that ends blank-page days',
      preview: 'Your content pillars, in 10 minutes.',
      body: [
        'Before any research, I write down my content pillars. These are the 3 to 6 topics my account covers. Nothing else gets filmed.',
        "Here's how to make yours in 10 minutes:",
        ['Write down the 3 questions people ask you most.', 'Write down 2 things you do every week that people would find interesting.', 'Turn each one into a topic with a few sub-topics under it.'],
        'Then pick a mix. For example, half your videos on your main topic and the rest spread across the others.',
        'Once you have pillars, "what should I post?" becomes "which pillar haven\'t I posted about this week?" That\'s a much easier question.',
        'Reply with your pillars. I read every one.',
      ],
    },
    {
      subject: 'How I find videos that already won',
      alt: 'Steal the structure, not the video',
      preview: 'What an outlier is and how to spot one.',
      body: [
        "An outlier is a video that got way more views than that creator usually gets. If an account with 5,000 followers gets 400,000 views, something in that video worked, and it wasn't the follower count.",
        "Here's how I look for them:",
        ['Search your pillar on TikTok or Reels, last 30 days only.', 'Skip celebrities, ads and trend dances.', "Keep the videos with way more views than that account's normal.", 'For each one, write down the first sentence they say and the text on screen.'],
        "Do this for 15 minutes and you'll have more ideas than you can film.",
        'The rule I never break: borrow the format, keep your own stories and numbers.',
        "What's one outlier you've seen lately in your niche? Reply and send me the link.",
      ],
    },
    {
      subject: 'Turn one hook into ten videos',
      alt: 'My fill-in-the-blank hooks',
      preview: 'Hook templates, and how to make your own.',
      body: [
        'Every time I find an outlier, I turn its first line into a fill-in-the-blank template.',
        'For example, "I tried ___ for 30 days. Here\'s what happened." works in almost any niche. So does "Stop doing ___ if you want ___."',
        "Once you have 10 to 20 of these, you're never starting from zero. You pick a template, pick a pillar, and fill in the blank with something real from your business.",
        'My Viral Video Researcher saves every hook it finds to a sheet and groups them into templates each week, so the list keeps growing on its own.',
        'Start your own list today. Even 5 templates is enough to get going.',
        "What's a hook you've seen that stuck with you? Reply with it.",
      ],
    },
    {
      subject: 'My weekly routine',
      alt: '30 minutes a week, ideas for the whole week',
      preview: 'How I plan a week of videos in one sitting.',
      body: [
        "Last one in this series. Here's how it all fits together into one weekly routine:",
        ["Once a week, spend 30 minutes on research. Find outliers in the pillar you've posted about least.", "Turn the best ones into 5 ideas, each with a hook, what you'll say and what's on screen.", 'Film all 5 in one session.', 'After they post, note which ones did well and do more of that next week.'],
        "That's it. No more staring at a blank page.",
        "If you want a system to do the first two steps for you, it's all in the Viral Video Researcher prompts I sent you.",
        "I'd love to hear how it's going. Reply and tell me what you're filming this week.",
      ],
    },
  ],

  'Getting views and followers': [
    {
      subject: 'The first 2 seconds',
      alt: 'Why your views stop at a few hundred',
      preview: 'Where most videos lose people.',
      body: [
        'You told me your biggest struggle is getting views and followers.',
        "Here's where most videos lose people: the first 2 seconds. If the opening doesn't make someone curious, nothing after it matters, because they've already scrolled.",
        'My best video so far got 591K views on TikTok. [FILL IN: 1 to 2 sentences on what the first line of that video was and why you think it worked.]',
        "Before you post your next video, ask one question: would a stranger stop scrolling for my first sentence? If not, rewrite it.",
        "Over the next two weeks I'll send you a few short emails on what's actually moved my numbers.",
        "What's the first line of your last video? Reply with it. I read every reply.",
      ],
    },
    {
      subject: 'One video, one point',
      alt: 'Why shorter videos got me more views',
      preview: 'The 20 to 25 second rule.',
      body: [
        'The fastest change I made to my videos: one point per video.',
        'When I try to fit three tips in one video, people leave halfway. When I make one point, fast, they stay to the end. In my experience, the videos people finish are the ones that get pushed to more people.',
        "So most of my quick videos are 20 to 25 seconds. If I have three good points, that's three videos, not one.",
        "Look at your last video. How many points did it make? If it's more than one, you just found your next two videos.",
        "Reply and tell me which video you're cutting into pieces.",
      ],
    },
    {
      subject: 'Nothing on screen for more than 6 seconds',
      alt: 'Why people scroll away halfway',
      preview: 'Give their eyes something new.',
      body: [
        'Here\'s a rule I use on every edit: nothing on screen stays the same for more than about 6 seconds.',
        "That doesn't mean flashy effects. It means something changes: a screenshot of the thing I'm talking about, a quick cut, a caption that lands on the key word.",
        'The best visuals are real. If I mention a result, I show the actual screenshot. If I mention a tool, I show the tool. People trust what they can see.',
        "Watch your last video on mute. Is there a stretch where nothing changes? That's probably where people are leaving.",
        'Reply and tell me what you found.',
      ],
    },
    {
      subject: 'Let other creators run your tests',
      alt: "Don't guess what will get views",
      preview: "Use other people's winners as your test results.",
      body: [
        'Every day, other creators in your niche are running tests for you. Some videos flop. Some get 10 times their usual views. You can see the results for free.',
        'I look for those outliers from the last 30 days, then borrow the format: the type of hook, the length, how it\'s shot. Never the content. My stories and numbers stay mine.',
        "That's what the Viral Video Researcher prompts do. They find the outliers, log the hooks, and turn them into ideas I can film.",
        'This week, find one video in your niche that did way better than that account usually does. Make your own version of the format.',
        "Reply with the link. I'm curious what you find.",
      ],
    },
    {
      subject: 'Views are nice. Follows are better.',
      alt: 'Turn viewers into followers',
      preview: 'What happens after someone taps your name.',
      body: [
        'Last one in this series.',
        'Views are only step one. A follow happens when someone taps your name and likes what they see.',
        "On my Instagram, 2.1K profile visits turned into 101 new follows. That's about 1 in 20. So the real question is: when someone lands on your profile, do they instantly know what you post and why they should follow?",
        'Check three things today:',
        ['Your bio says who you help and with what, in one line.', 'Your pinned posts are your best 3 videos.', 'Your last 9 posts look like one account, not 9 different ones.'],
        "I'd love to hear how your views are going. Reply anytime and tell me.",
      ],
    },
  ],

  'Editing takes too long': [
    {
      subject: "Editing isn't slow. Deciding is.",
      alt: 'Why editing takes you hours',
      preview: 'Write your style down once.',
      body: [
        'You told me editing takes too long. Same for me, until I figured out why.',
        "Most of the time isn't cutting. It's deciding. Which font? Where do the captions go? How long does the title stay up? Every video, the same questions.",
        'So I answered them once. I took 3 videos whose editing I loved and wrote down exactly what the editor did: how tight the cuts are, the title style, caption size and position, when screenshots show up. That became my style sheet.',
        'Now every edit follows the same rules, and my AI Video Editor uses that sheet to do the edit for me.',
        "Whose editing do you want yours to look like? Reply with their name or a link.",
      ],
    },
    {
      subject: 'Keep the hook, the payoff, and nothing else',
      alt: 'The fastest way to a tight edit',
      preview: 'What I keep and what I cut.',
      body: [
        "Here's the simplest editing rule I know: find the hook, find the payoff, and keep only the lines that get you from one to the other.",
        'Everything else goes. Ums, restarts, the second take of the same sentence, the "so basically" at the start.',
        "I let AI do this part. It transcribes the video word by word, finds the filler and cuts it with no gaps, so the edit stays tight without me scrubbing through the timeline.",
        "One rule I never break: never stitch words together in a way that changes what I meant.",
        'Try it on your next video. Before you edit, write down the hook and the payoff. Then cut everything that doesn\'t connect them.',
        'Reply and tell me how much shorter it got.',
      ],
    },
    {
      subject: 'Approve the plan before the edit',
      alt: 'Stop redoing your edits',
      preview: 'The cheapest place to catch a bad edit.',
      body: [
        "The slowest part of editing used to be redoing things. I'd finish an edit, watch it, and realize the title was wrong or a screenshot was missing.",
        "Now nothing gets made until I approve a storyboard: the script with what's kept and cut, the title, and what's on screen at each moment.",
        "It takes 2 minutes to read and saves me from redoing a whole edit. It's the cheapest place to catch a mistake.",
        'My AI Video Editor sends me the storyboard first and waits for me to say "approved."',
        'Even if you edit by hand, try it: plan the cuts and visuals on paper first, then open your editing app.',
        'Reply and tell me what you usually end up redoing.',
      ],
    },
    {
      subject: 'I make the AI grade its own edits',
      alt: 'The step that saves me the most time',
      preview: 'A score out of 10, before I ever see it.',
      body: [
        'Before any edit gets to me, my AI editor reviews its own work like a harsh editor.',
        "It looks at every frame and scores the video from 1 to 10 on things like the hook, how tight it is, whether captions are readable on a phone, and pacing. Then it fixes the 3 biggest problems and scores it again, until everything is an 8 or higher.",
        "That means the first version I see is already pretty good. I'm not spending my time catching small mistakes.",
        'You can do a simple version yourself: before you post, watch your video once on your phone with the sound off. Write down the 3 worst moments and fix those.',
        "What's the one thing you always notice too late? Reply and tell me.",
      ],
    },
    {
      subject: 'My editor gets better every week',
      alt: 'Never fix the same mistake twice',
      preview: 'Turn every correction into a rule.',
      body: [
        'Last one in this series.',
        'The reason my editing keeps getting faster: every time I correct an edit, the correction becomes a rule.',
        "If I fix a caption that covered my face, I don't just fix that video. I tell the AI to add \"captions never cover my mouth\" to its rules. Next week, it doesn't happen.",
        "After a few weeks, the editor makes my choices without me. That's when editing stops eating my whole day.",
        'If you edit by hand, keep a simple list of your rules and read it before every edit. Same idea.',
        "I'd love to hear how your editing is going. Reply anytime.",
      ],
    },
  ],

  'Turning views into customers': [
    {
      subject: "Views don't pay the bills",
      alt: 'What I measure instead of views',
      preview: 'The numbers that actually matter.',
      body: [
        "You told me your biggest struggle is turning views into customers. That's the one that matters most, so I'm glad you said it.",
        "Views feel good, but they don't pay the bills. What I look at instead: profile visits, follows, link taps, and how many people actually took the next step.",
        'One restaurant video I made got 930 profile visits, 167 follows and 32 people tapping the address. Those 32 are the number the owner cares about.',
        'This week, look past the views on your last video. How many people visited your profile? How many tapped your link?',
        'Reply and tell me what you sell. I read every reply.',
      ],
    },
    {
      subject: 'Who are you actually trying to reach?',
      alt: 'Not everyone who watches is a customer',
      preview: 'Write down your ideal client in 10 minutes.',
      body: [
        'Most people make content for everyone, so it lands with no one in particular.',
        'Before I do any outreach, I write a one-page ideal client profile: what kind of business, where, how big, and the signs they invest in themselves (an active Instagram, recent posts, good reviews, a new location).',
        "Then I write down the red flags too, from bad fits I've had before.",
        'Once that\'s written, two things get easier. My videos speak to one person. And I know exactly who to reach out to.',
        'Try it: write 5 lines describing your best client so far and why they were great.',
        'Reply with it if you want. I read every one.',
      ],
    },
    {
      subject: 'The first message I send (no pitch)',
      alt: 'Why my first message never sells',
      preview: 'Under 90 words, one easy question.',
      body: [
        "When I reach out to a business, my first message doesn't pitch anything. Its only job is to get a reply.",
        "Here's the structure:",
        ['One specific thing I noticed about their business (a recent post, a new menu item, a review).', 'One local detail.', 'One line on who I am.', 'One easy either-or question they can answer in a few words.'],
        'No link, no offer, under 90 words.',
        "The specific detail is the whole thing. If I can't find something real to mention, I don't send it, because a vague message reads like a template.",
        "Reply and tell me what kind of business you'd reach out to first.",
      ],
    },
    {
      subject: 'Most replies come from follow-ups',
      alt: "Don't stop after one message",
      preview: 'Day 3, day 7, day 14.',
      body: [
        'Most people send one message, hear nothing, and give up. But most replies come from follow-ups, not the first message.',
        "Here's the schedule I use:",
        ['Day 3: a short bump with one new idea for their business.', "Day 7: a quick example of a result I've gotten, or a teaser of an idea for them. Still no hard pitch.", 'Day 14: a polite close-the-loop message.'],
        "If they reply at any point, the follow-ups stop and I ask for a quick call. And if anyone says they're not interested, they never hear from me again.",
        'The Outreach System prompts I sent you track all of this in one sheet, so nobody slips through.',
        'Reply and tell me: how many people have you followed up with this month?',
      ],
    },
    {
      subject: 'Your content is your best outreach',
      alt: 'How my videos and my DMs work together',
      preview: 'Use the views you already have.',
      body: [
        'Last one in this series.',
        'Content and outreach work best together. When I reach out to a business, my videos do half the selling. They can see what I do before I ever pitch.',
        'It works the other way too. A short Instagram voice note that mentions a real video they posted ("I just came from your video about ___") gets far more attention than a cold DM, in my experience. I follow them and engage with a few posts first, so my name isn\'t brand new.',
        "So keep posting, and start reaching out to 5 businesses a week that fit your ideal client. That's how views turn into customers.",
        "I'd love to hear what happens. Reply anytime and tell me about your first reply.",
      ],
    },
  ],
};

const FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif";

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function hasFillIn(email) {
  return JSON.stringify(email).includes('[FILL IN');
}

// Build one email for one person. unsubscribeUrl and mailingAddress go in the
// footer (both required before these can be sent as marketing email).
// Returns null if the email still has a [FILL IN] or the footer is incomplete.
function render(struggle, index, { name, unsubscribeUrl, mailingAddress } = {}) {
  const track = TRACKS[struggle];
  const email = track && track[index];
  if (!email || hasFillIn(email) || !unsubscribeUrl || !mailingAddress) return null;
  const first = String(name || '').trim().split(/\s+/)[0] || '';
  const hey = first ? `Hey ${first},` : 'Hey,';

  const htmlParts = email.body.map((b) => (Array.isArray(b)
    ? `<ol style="margin:0 0 16px;padding-left:22px;font:16px/1.6 ${FONT};color:#1a1a1a">${b.map((li) => `<li style="margin:0 0 6px">${esc(li)}</li>`).join('')}</ol>`
    : `<p style="margin:0 0 16px;font:16px/1.6 ${FONT};color:#1a1a1a">${esc(b)}</p>`));

  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(email.subject)}</title></head>
<body style="margin:0;padding:0;background:#ffffff">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(email.preview)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px"><tr><td>
  <p style="margin:0 0 16px;font:16px/1.6 ${FONT};color:#1a1a1a">${esc(hey)}</p>
  ${htmlParts.join('\n  ')}
  <p style="margin:0;font:16px/1.6 ${FONT};color:#1a1a1a">Nathan</p>
  <p style="margin:36px 0 0;padding-top:16px;border-top:1px solid #eeeeee;font:12px/1.6 ${FONT};color:#8a8a8a">You&rsquo;re getting this because you asked for my prompts at <a href="${SITE}/studio/" style="color:#8a8a8a">vocreativeco.com/studio</a>. <a href="${esc(unsubscribeUrl)}" style="color:#8a8a8a">Unsubscribe</a><br>${esc(mailingAddress)}</p>
</td></tr></table>
</td></tr></table>
</body></html>`;

  const text = [
    hey,
    '',
    ...email.body.flatMap((b) => (Array.isArray(b) ? [...b.map((li, i) => `${i + 1}. ${li}`), ''] : [b, ''])),
    'Nathan',
    '',
    '--',
    `You're getting this because you asked for my prompts at ${SITE}/studio/`,
    `Unsubscribe: ${unsubscribeUrl}`,
    mailingAddress,
  ].join('\n');

  return { subject: email.subject, preview: email.preview, html, text };
}

module.exports = { TRACKS, DAYS, render, hasFillIn };
