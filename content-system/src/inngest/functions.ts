import { inngest } from "./client";
import {
  flagOverdueJobs,
  pullWeeklyResearch,
  sendFootageReminders,
  sendQueuedNotifications,
  sweepPendingReviews,
} from "@/lib/notify/jobs";

/** Scheduled background jobs. Times are UTC. */
export const deliverNotifications = inngest.createFunction(
  { id: "deliver-notifications", triggers: [{ cron: "*/5 * * * *" }] },
  async ({ step }) => step.run("send queued emails", () => sendQueuedNotifications()),
);

export const pendingReviews = inngest.createFunction(
  { id: "sweep-pending-reviews", triggers: [{ cron: "*/15 * * * *" }] },
  async ({ step }) => step.run("re-run unfinished checks", () => sweepPendingReviews()),
);

export const dailyReminders = inngest.createFunction(
  { id: "daily-reminders", triggers: [{ cron: "0 15 * * *" }] },
  async ({ step }) => {
    const reminders = await step.run("footage reminders (day 3 and 6)", () => sendFootageReminders());
    const overdue = await step.run("overdue edit jobs", () => flagOverdueJobs());
    return { reminders, overdue };
  },
);

export const weeklyResearch = inngest.createFunction(
  { id: "weekly-research", triggers: [{ cron: "0 12 * * 1" }] },
  async ({ step }) => step.run("pull outliers per niche", () => pullWeeklyResearch()),
);

export const functions = [deliverNotifications, pendingReviews, dailyReminders, weeklyResearch];
