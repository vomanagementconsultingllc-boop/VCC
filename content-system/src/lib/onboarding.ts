/**
 * The onboarding call IS the voice interview. Ask every question so the
 * profile is complete on the first pass. Let them ramble: the rambling is
 * the data.
 */
export const VOICE_QUESTIONS = [
  "Tell me about the last customer you were really happy to work with. What happened?",
  "When someone asks why you cost more than the place down the road, what do you actually say?",
  "What do customers get wrong about your industry before they come to you?",
  "What is the one thing you find yourself explaining over and over?",
  "What is the mistake you see other businesses in your space make that drives you mad?",
  "Describe your best offer to me like I am a customer standing in front of you right now.",
  "What would a loyal customer say about you to their friend? Use their words, not yours.",
  "What topics will you never talk about on camera?",
  "Which words or phrases do you hate when marketers use them for businesses like yours?",
  "Send me two or three posts or videos, yours or anyone's, that sound like you. Why those?",
  "Walk me through a normal day. Where in it could you record a 60 second video on your phone?",
  "Who exactly are we trying to reach, and what are they doing when they see your video?",
];

export const LOGISTICS_QUESTIONS = [
  "Which platforms, and how many posts per week can you realistically post yourself?",
  "Who on your side records, and who posts? Same person?",
  "Phone model, and do you have a tripod or a stand?",
  "Which days and times can you shoot each week?",
  "What result would make you say this was worth it after 90 days?",
];

/** Logistics answers stored on the voice profile (intake_answers). */
export const INTAKE_FIELDS = [
  { key: "who_records", label: "Who records" },
  { key: "who_posts", label: "Who posts" },
  { key: "phone_model", label: "Phone model" },
  { key: "tripod", label: "Tripod or stand" },
  { key: "shoot_times", label: "Days and times they can shoot" },
  { key: "success_90_days", label: "What makes this worth it after 90 days" },
] as const;

export type IntakeAnswers = Partial<Record<(typeof INTAKE_FIELDS)[number]["key"], string>>;
