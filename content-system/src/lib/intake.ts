/**
 * The questionnaire a client answers the first time they sign in. It feeds
 * two things: the research engine (what to go looking for) and the shooting
 * directions (where they can film and what they film with).
 *
 * Answers are stored as one JSON object keyed by `key`. `niche_keywords` is
 * stored as a list, because it becomes the research search terms.
 */
export type IntakeField = {
  key: string;
  label: string;
  hint?: string;
  kind: "text" | "long" | "choice" | "multi";
  options?: string[];
  placeholder?: string;
  required?: boolean;
};

export type IntakeSection = { id: string; title: string; says: string; fields: IntakeField[] };

export const INTAKE: IntakeSection[] = [
  {
    id: "business",
    title: "Your business",
    says: "First, tell me about what you do. Write it the way you'd say it out loud.",
    fields: [
      { key: "what_you_do", label: "What do you do, and for whom?", kind: "long", required: true, placeholder: "I run a family dental practice. Mostly nervous adults who have put it off for years." },
      { key: "best_offer", label: "What is the one thing you most want people to book or buy?", kind: "long" },
      { key: "customers", label: "Describe your best customer", hint: "Age, situation, what they are worried about when they find you.", kind: "long" },
      { key: "known_for", label: "What do you want to be known for?", kind: "text" },
      { key: "area", label: "Where are your customers?", kind: "text", placeholder: "Detroit and the suburbs, or online everywhere" },
    ],
  },
  {
    id: "research",
    title: "What I should look for",
    says: "This is what I'll use to go and find videos that are already working for people like you.",
    fields: [
      { key: "niche_keywords", label: "Words people would search to find a business like yours", hint: "Three to eight, separated by commas. These are my search terms.", kind: "text", required: true, placeholder: "dentist, teeth whitening, nervous patients, invisalign" },
      { key: "creators_liked", label: "Accounts you enjoy watching (yours or anyone's)", hint: "Names or links. Any platform.", kind: "long" },
      { key: "videos_liked", label: "Two or three videos you wish you had made", hint: "Paste the links.", kind: "long" },
      { key: "competitors", label: "Who else do your customers consider?", kind: "text" },
      { key: "talk_all_day", label: "What could you talk about all day?", kind: "long" },
      { key: "questions_asked", label: "What do customers ask you over and over?", kind: "long" },
      { key: "topics_avoid", label: "Anything you will not talk about on camera?", kind: "long" },
      { key: "platforms", label: "Where will you post?", kind: "multi", options: ["Instagram", "TikTok", "YouTube Shorts", "Facebook", "LinkedIn"] },
    ],
  },
  {
    id: "places",
    title: "Where you will shoot",
    says: "The more you tell me here, the better my directions will be. I'll plan each video around the places you actually have.",
    fields: [
      { key: "locations", label: "List every place you could film", hint: "One per line. Say what it looks like: the front desk, a treatment room, your car, the workshop, outside the shop.", kind: "long", required: true, placeholder: "Front desk: bright, logo on the wall behind\nTreatment room 2: clean, big window on the left\nMy car: parked outside, quiet" },
      { key: "best_light", label: "Which of those has the best light, and when?", hint: "A window with daylight beats any lamp.", kind: "text", placeholder: "Treatment room 2, mornings until about 11" },
      { key: "noise", label: "How noisy is it?", hint: "Phones ringing, machines, customers, traffic. Tell me which places are quiet.", kind: "long" },
      { key: "on_show", label: "What can I ask you to show?", hint: "Tools, products, the process, before and afters, the team, the building.", kind: "long" },
      { key: "off_limits", label: "What must never be in shot?", hint: "Customers' faces, paperwork, screens, a neighbour's sign.", kind: "long" },
      { key: "customers_on_camera", label: "Can customers or staff appear?", kind: "choice", options: ["Yes, with their permission", "Staff only", "Just me", "Not sure yet"] },
    ],
  },
  {
    id: "gear",
    title: "Your phone and you",
    says: "Nearly there. A few quick ones about what you film with.",
    fields: [
      { key: "phone", label: "Which phone do you have?", kind: "text", placeholder: "iPhone 14" },
      { key: "tripod", label: "Do you have a tripod or stand?", kind: "choice", options: ["Yes", "No, I prop it up", "No, someone holds it"] },
      { key: "microphone", label: "Any microphone?", kind: "choice", options: ["No, just the phone", "Wired or clip-on mic", "Wireless mic"] },
      { key: "who_films", label: "Who presses record?", kind: "choice", options: ["Me, on my own", "Someone on my team", "It varies"] },
      { key: "on_camera", label: "Who will be on camera?", kind: "text", placeholder: "Me, and sometimes my hygienist Sam" },
      { key: "comfort", label: "How do you feel about being on camera?", kind: "choice", options: ["Love it", "Fine once I start", "Nervous", "I would rather not show my face"] },
    ],
  },
  {
    id: "time",
    title: "Time and goals",
    says: "Last bit. Then I'll get to work on your first week.",
    fields: [
      { key: "shoot_times", label: "Which days and times can you film?", kind: "text", placeholder: "Tuesdays and Thursdays before 9am" },
      { key: "videos_per_week", label: "How many videos can you realistically film each week?", kind: "choice", options: ["1 to 2", "3 to 4", "5 to 7"] },
      { key: "success", label: "What would make this worth it 90 days from now?", kind: "long" },
      { key: "anything_else", label: "Anything else I should know?", kind: "long" },
    ],
  },
];

export const INTAKE_FIELDS: IntakeField[] = INTAKE.flatMap((section) => section.fields);

export type IntakeAnswers = Record<string, string | string[]>;

/** Turn the submitted form into the stored answers object. */
export function readIntake(formData: FormData): IntakeAnswers {
  const answers: IntakeAnswers = {};
  for (const field of INTAKE_FIELDS) {
    if (field.kind === "multi") {
      const picked = formData.getAll(field.key).map(String).filter(Boolean);
      if (picked.length) answers[field.key] = picked;
      continue;
    }
    const raw = formData.get(field.key);
    const value = typeof raw === "string" ? raw.trim().slice(0, 4000) : "";
    if (!value) continue;
    answers[field.key] =
      field.key === "niche_keywords"
        ? value.split(/[,\n]/).map((k) => k.trim()).filter(Boolean).slice(0, 12)
        : value;
  }
  return answers;
}

export function missingRequired(answers: IntakeAnswers): IntakeField[] {
  return INTAKE_FIELDS.filter((f) => f.required && !answers[f.key]);
}

/** Where and how a client can film, as plain text for writing shooting directions. */
export function shootingContext(answers: IntakeAnswers | null | undefined): string {
  if (!answers) return "";
  const line = (label: string, key: string) => {
    const value = answers[key];
    const text = Array.isArray(value) ? value.join(", ") : value;
    return text ? `${label}: ${text}` : "";
  };
  return [
    line("Places they can film", "locations"),
    line("Best light", "best_light"),
    line("Noise", "noise"),
    line("What they can show", "on_show"),
    line("Never in shot", "off_limits"),
    line("Other people on camera", "customers_on_camera"),
    line("Phone", "phone"),
    line("Tripod", "tripod"),
    line("Microphone", "microphone"),
    line("Who films", "who_films"),
    line("Comfort on camera", "comfort"),
  ]
    .filter(Boolean)
    .join("\n");
}
