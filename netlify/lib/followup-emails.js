// Follow-up emails after someone answers the 4 questions on vocreativeco.com/studio.
// One 5-email track per answer to "What are you struggling with most right now?".
// Goal: stay in touch. Every email teaches one thing and asks for a reply.
//
// Writing rules: first person, short lines, real facts only. {first} becomes
// the person's first name ("you" if we don't have it). See blocks() for the
// building blocks an email body can use.
// Anything in [FILL IN: ...] must be replaced before that email can be sent;
// render() refuses to build an email that still has one.

const SITE = 'https://vocreativeco.com';

// Days after the person answers the questions.
const DAYS = [1, 3, 6, 10, 14];

const TRACKS = {
  // Jun-style variations: 1 before/after, 2 homework rule, 3 excuse bingo,
  // 4 money talk ("If you..." section matched to their "why" answer),
  // 5 letter from future them.
  'Knowing what to post': [
    {
      subject: 'What should I post today? 😩',
      alt: 'Never stare at a blank page again',
      preview: "Here's how I come up with ideas now.",
      body: [
        'You told me your biggest struggle is knowing what to post.',
        'So let me show you how that looks for you now.',
        { lines: ['<b>Before:</b> 😩', 'Open Instagram.', 'Scroll for "inspiration."', 'Write an idea. Delete it.', 'Scroll some more.', 'An hour later... still nothing to film.'] },
        { lines: ['<b>Now:</b> 😌', 'Open Claude.', "Get 6 to 8 ideas based on what's already working in your niche.", 'Pick one.', 'Film.'] },
        "That's it. ✨",
        'This is my Viral Video Researcher. 🤖',
        "Here's how it works 👇",
        { lines: ['<b>Step 1: It learns your account 📋</b>', 'You tell it what you post, who it\'s for and your 3 to 6 content pillars. It only brings back ideas that fit you.'] },
        { lines: ['<b>Step 2: It finds the winners 🔎</b>', 'It searches TikTok and Reels from the last 30 days for outliers: videos that got way more views than that creator usually gets.'] },
        { lines: ['<b>Step 3: It hands you ideas you can film 🎬</b>', "For each one: the hook line in your voice, what to say, what to show on screen, and how long it'll stay relevant."] },
        'And the one thing it never does? Make things up. If it can\'t quote a hook word for word, it writes "not transcribed." Your stories and numbers stay yours. 💛',
        "The setup prompts are in the email I sent you when you signed up. And if you get stuck, there's a help thread for it in my free Discord.",
        { btn: 'Ok, show me how everyone\'s using it 👀' },
        { sign: true },
        "P.S. What's your niche? Hit reply and tell me in one line.",
      ],
    },
    {
      subject: 'Homework: the 15-3-1 rule 📝',
      alt: '15 minutes, 3 outliers, 1 video',
      preview: 'It takes 15 minutes, I promise.',
      body: [
        "I've got a little homework for you. It takes 15 minutes, I promise.",
        "It's called the 15-3-1 rule, and it's how I find ideas without any tools at all.",
        "Here's how it works 👇",
        { lines: ['⏱️ <b>15 minutes.</b> Set a timer.', "🔎 <b>3 outliers.</b> Search your niche on TikTok or Reels. Find videos from the last 30 days that got way more views than that account usually gets. (5,000 followers and 400K views? That's one.)", '🎬 <b>1 video.</b> Pick your favorite and make your own version.'] },
        "And here's the magic part.",
        "You don't copy the video. You copy the shape: the hook, the length, how it's filmed.",
        'Then you fill it with your own story. ✨',
        'Write each one down like this:',
        { lines: ['🪝 <b>Hook:</b> their first line, turned into a fill-in-the-blank', '🧱 <b>Format:</b> talking to camera, voiceover, screen recording...', '💡 <b>Why it spread:</b> one sentence'] },
        "Boom. That's your next video.",
        'And if you want this to run on its own? 🤖',
        'My Viral Video Researcher does the searching for you, logs every hook in a Google Sheet and turns them into ideas. It\'s in the prompts I sent you.',
        'Found your 3? Come show them off in the Discord. 👇',
        { btn: 'I found mine, let me share them 🙋' },
        'Go find your 3 outliers.',
        { sign: true },
        'P.S. Found a really good one? Reply with the link. I want to see it.',
      ],
    },
    {
      subject: 'Content excuse bingo 🎯',
      alt: "I've heard every excuse (and used most of them)",
      preview: 'I name an excuse. Then I bust it.',
      body: [
        'Ok, I\'ve heard every "I don\'t know what to post" excuse in the book. 😅',
        "(Trust me, I've used most of them myself.)",
        "So let's play a game.",
        '<b>CONTENT EXCUSE BINGO 🎯</b>',
        'I name an excuse. Then I bust it. 👇',
        { lines: ['🟩 "I have nothing interesting to say."', "❌ Busted. You don't need brand new ideas. You need ideas that already worked, told your way. That's what outliers are for."] },
        { lines: ['🟩 "Everything in my niche has been done."', "❌ Busted. The researcher tells you what's overdone and what's underused, so you post what nobody's covering yet."] },
        { lines: ['🟩 "I\'ll run out of ideas in a week."', '❌ Busted. It saves every hook to a sheet and turns them into templates. The list only grows.'] },
        { lines: ['🟩 "I don\'t have time to research."', '❌ Busted. You can put it on a schedule, like Tuesday and Friday nights, and wake up to new ideas.'] },
        { lines: ['🟩 "My videos never get views anyway."', "❌ Busted. Starting from what's already working gives you a head start. One of mine hit 591K. 👇"] },
        { img: 'img/proof/01.jpg', alt: 'TikTok analytics: 591.3K views' },
        "So... what's yours?",
        "Because ngl, every excuse gets the same answer: stop guessing, and start from what's already working.",
        "And if you get stuck, that's what my free Discord is for. 💛",
        { btn: "Ok, I'm out of excuses 🙋" },
        { sign: true },
        "P.S. Got an excuse I didn't bust? Hit reply. I dare you. 😏",
      ],
    },
    {
      subject: 'Can we talk about money for a sec? 💸',
      alt: 'It was never about views',
      preview: 'Being the first name people think of.',
      body: [
        'Can we talk about money for a sec?',
        'Most people think posting is about views and followers.',
        "It's not.",
        "It's about being the first name people think of.",
        'So when someone needs what you do, they come to YOU.',
        "Here's why that matters for you 👇",
        { only: 'To build a personal brand', blocks: [
          '<b>If you want to build a personal brand</b>',
          'People follow people, not logos.',
          'The more they see how you think, the more they trust you. And trust is what turns into opportunities later.',
          { btn: 'Ok, help me build mine 🙌' },
        ] },
        { only: 'To promote my business', blocks: [
          '<b>If you want to promote your business</b>',
          "People don't fall in love with a product. They fall in love with the person behind it.",
          "That's why someone picks you over the cheaper option down the road.",
          "Here's a restaurant video I made 👇 930 profile visits, 167 follows, and 32 people tapped the address.",
          { img: 'img/proof/07.jpg', alt: 'Instagram reel insights for a restaurant video: 930 profile visits, 167 follows, 32 business address taps' },
          { btn: 'Ok, put my business on the map 📍' },
        ] },
        { only: 'To generate sales', blocks: [
          '<b>If you want to generate sales</b>',
          'People buy from people they trust. And they trust the people whose story they know.',
          'Your videos do the selling before the conversation even starts.',
          { btn: 'Ok, make me the obvious choice 💸' },
        ] },
        { only: 'To get opportunities', blocks: [
          '<b>If you want to get opportunities</b>',
          'Opportunities find the people who are visible.',
          'Collabs, clients, jobs. They go to the person people already feel like they know.',
          { btn: 'Ok, make people notice me 👀' },
        ] },
        'So no, this was never about views.',
        "And knowing what to post is step one. That's exactly what the Viral Video Researcher is for.",
        '"But Nathan, I don\'t have time to post every day." 😅',
        'I know. That\'s why the AI finds the ideas. You just pick one and film.',
        'And in my free Discord you can ask me anything, get help setting it up and see what everyone else is building.',
        { btn: 'Let me in 🙌' },
        'Be the first name they think of.',
        { sign: true },
      ],
    },
    {
      subject: 'A letter from future {first} 💌',
      alt: 'What future you wants to tell you',
      preview: 'I wrote it for you.',
      body: [
        'I kept wondering: what would future {first} say, if they could write to you today?',
        "So I wrote it for you. Here it is. 👇",
        { letter: [
          '{date+30}',
          'Dear me,',
          'Remember when you never knew what to post?',
          "You'd open Instagram, scroll for an hour and close it with nothing.",
          "You said you weren't creative enough. That everything in your niche had already been done.",
          "I'm so glad you didn't listen to yourself.",
          'Week 1, you found your first 3 outliers. One was so good you made your own version that same night.',
          'You almost deleted it before you hit post.',
          'By week 2, you had a list of hooks you could use anytime.',
          'By week 3, you stopped asking "what should I post?" and started asking "which one first?"',
          'Now you\'ve got a sheet full of ideas. And people are starting to recognize your face.',
          'Thank you for not waiting.',
          'Love,<br>You (a month from now) 💛',
        ] },
        'Ok, back to me.',
        "That letter starts with one idea. And you don't have to figure it out alone.",
        'In my free Discord, you can ask me anything, get help with the Viral Video Researcher and see what everyone else is building.',
        { btn: "Ok, let's make that letter real 🫣" },
        'See you inside.',
        { sign: true },
        'P.S. What would future you thank you for? Hit reply. I read every one.',
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
const DISCORD_URL = 'https://discord.gg/jSfpvGcPmA';

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
// Copy may use <b> and <br> only; everything else is escaped.
function rich(s) {
  return esc(s).replace(/&lt;(\/?)b&gt;/g, '<$1b>').replace(/&lt;br&gt;/g, '<br>');
}
function plain(s) {
  return String(s).replace(/<\/?b>/g, '').replace(/<br>/g, '\n');
}

function hasFillIn(email) {
  return JSON.stringify(email).includes('[FILL IN');
}

const P = `margin:0 0 16px;font:16px/1.6 ${FONT};color:#1a1a1a`;

// Turns body blocks into { html, text } parts.
//   'string'                 a paragraph (<b> and <br> allowed)
//   ['a', 'b']               a numbered list (older emails)
//   { lines: [...] }         lines with no gap between them
//   { btn: 'Text' }          a button to the Discord invite (or { btn, href })
//   { img: 'img/...', alt }  an image from the site
//   { only: 'answer', blocks }  shown only to people whose "why" answer matches
//                            (everyone sees all of them if we don't know theirs)
//   { letter: [...] }        an indented letter
//   { sign: true }           the sign-off
function blocks(list, ctx) {
  const html = [];
  const text = [];
  const sub = (s) => String(s)
    .replace(/\{first\}/g, ctx.first || 'you')
    .replace(/\{date\+30\}/g, ctx.letterDate);
  list.forEach((b) => {
    if (typeof b === 'string') {
      html.push(`<p style="${P}">${rich(sub(b))}</p>`);
      text.push(plain(sub(b)), '');
    } else if (Array.isArray(b)) {
      html.push(`<ol style="margin:0 0 16px;padding-left:22px;font:16px/1.6 ${FONT};color:#1a1a1a">${b.map((li) => `<li style="margin:0 0 6px">${rich(sub(li))}</li>`).join('')}</ol>`);
      text.push(...b.map((li, i) => `${i + 1}. ${plain(sub(li))}`), '');
    } else if (b.lines) {
      html.push(`<p style="${P}">${b.lines.map((l) => rich(sub(l))).join('<br>')}</p>`);
      text.push(...b.lines.map((l) => plain(sub(l))), '');
    } else if (b.btn) {
      const href = b.href || DISCORD_URL;
      html.push(`<p style="margin:4px 0 22px"><a href="${esc(href)}" style="display:inline-block;padding:14px 20px;background:#0a0a0a;border-radius:12px;font:700 16px/1.2 ${FONT};color:#ffffff;text-decoration:none">&#128073; ${esc(sub(b.btn))}</a></p>`);
      text.push(`👉 ${plain(sub(b.btn))}: ${href}`, '');
    } else if (b.img) {
      html.push(`<p style="margin:0 0 18px"><img src="${SITE}/studio/${esc(b.img)}" alt="${esc(b.alt || '')}" width="320" style="display:block;width:100%;max-width:320px;height:auto;border:1px solid #e6e6e6;border-radius:12px"></p>`);
    } else if (b.only) {
      if (!ctx.why || ctx.why === b.only) {
        const inner = blocks(b.blocks, ctx);
        html.push(...inner.html);
        text.push(...inner.text);
      }
    } else if (b.letter) {
      const inner = b.letter.map((l) => `<p style="margin:0 0 12px;font:italic 16px/1.6 Georgia, 'Times New Roman', serif;color:#1a1a1a">${rich(sub(l))}</p>`).join('');
      html.push(`<div style="margin:0 0 20px;padding:18px 20px 6px;border-left:3px solid #0a0a0a;background:#fafafa;border-radius:0 12px 12px 0">${inner}</div>`);
      text.push(...b.letter.map((l) => `  ${plain(sub(l))}`), '');
    } else if (b.sign) {
      html.push(`<p style="${P}">Nathan</p>`);
      text.push('Nathan', '');
      ctx.signed = true;
    }
  });
  return { html, text };
}

// Build one email for one person.
//   name, why            their first name and their "why" answer (optional)
//   sendDate             when it goes out (for the date in the letter email)
//   unsubscribeUrl, mailingAddress   required in the footer of marketing email
// Returns null if the email still has a [FILL IN] or the footer is incomplete.
function render(struggle, index, { name, why, sendDate, unsubscribeUrl, mailingAddress } = {}) {
  const track = TRACKS[struggle];
  const email = track && track[index];
  if (!email || hasFillIn(email) || !unsubscribeUrl || !mailingAddress) return null;
  const first = String(name || '').trim().split(/\s+/)[0] || '';
  const when = new Date(sendDate || Date.now());
  const letterDate = new Date(when.getTime() + 30 * 864e5).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'America/Detroit' });
  const ctx = { first, why, letterDate, signed: false };
  const body = blocks(email.body, ctx);
  if (!ctx.signed) { body.html.push(`<p style="${P}">Nathan</p>`); body.text.push('Nathan', ''); }
  const subject = email.subject.replace(/\{first\}/g, first || 'you');
  const hey = first ? `Hey ${first},` : 'Hey,';

  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(subject)}</title></head>
<body style="margin:0;padding:0;background:#ffffff">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(email.preview)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px"><tr><td>
  <p style="${P}">${esc(hey)}</p>
  ${body.html.join('\n  ')}
  <p style="margin:36px 0 0;padding-top:16px;border-top:1px solid #eeeeee;font:12px/1.6 ${FONT};color:#8a8a8a">You&rsquo;re getting this because you asked for my prompts at <a href="${SITE}/studio/" style="color:#8a8a8a">vocreativeco.com/studio</a>. <a href="${esc(unsubscribeUrl)}" style="color:#8a8a8a">Unsubscribe</a><br>${esc(mailingAddress)}</p>
</td></tr></table>
</td></tr></table>
</body></html>`;

  const text = [
    hey,
    '',
    ...body.text,
    '--',
    `You're getting this because you asked for my prompts at ${SITE}/studio/`,
    `Unsubscribe: ${unsubscribeUrl}`,
    mailingAddress,
  ].join('\n');

  return { subject, preview: email.preview, html, text };
}

module.exports = { TRACKS, DAYS, render, hasFillIn };
