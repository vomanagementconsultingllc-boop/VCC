import "server-only";
import { Resend } from "resend";
import { publicEnv } from "@/lib/env";

const escapeHtml = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** One plain, branded email: a subject, a few lines, and a button into the app. */
export function renderEmail(input: { subject: string; body: string; link: string }): { html: string; text: string } {
  const url = input.link ? `${publicEnv.siteUrl}${input.link}` : publicEnv.siteUrl;
  const paragraphs = input.body
    .split(/\n+/)
    .filter((line) => line.trim())
    .map((line) => `<p style="line-height:1.5;margin:0 0 14px;">${escapeHtml(line)}</p>`)
    .join("");
  const html = `<div style="font-family:Arial,Helvetica,sans-serif;color:#251D16;max-width:480px;margin:0 auto;padding:24px;">
  <p style="font-family:Georgia,serif;font-size:18px;letter-spacing:0.02em;margin:0 0 20px;">Vo Creative Co.</p>
  <h2 style="font-weight:normal;margin:0 0 14px;">${escapeHtml(input.subject)}</h2>
  ${paragraphs}
  <p style="margin:22px 0;"><a href="${escapeHtml(url)}" style="display:inline-block;background:#A77B3E;color:#FAF5EC;text-decoration:none;padding:14px 22px;border-radius:8px;">Open it</a></p>
  <p style="line-height:1.5;color:#70604D;font-size:13px;margin:0;">You sign in with your email, no password. You can change which emails you get in Settings.</p>
</div>`;
  return { html, text: `${input.subject}\n\n${input.body}\n\n${url}` };
}

export type SendResult = "sent" | "skipped" | "failed";

export async function sendEmail(input: { to: string; subject: string; body: string; link: string }): Promise<SendResult> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!key || !from) {
    // No mail provider configured (local development): say what would have gone out.
    console.info(`[email not sent: RESEND_API_KEY or EMAIL_FROM missing] to=${input.to} subject=${input.subject}`);
    return "skipped";
  }
  const { html, text } = renderEmail(input);
  try {
    const { error } = await new Resend(key).emails.send({ from, to: input.to, subject: input.subject, html, text });
    return error ? "failed" : "sent";
  } catch {
    return "failed";
  }
}
