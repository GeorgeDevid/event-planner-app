import { Resend } from "@convex-dev/resend";
import { components } from "../_generated/api";
import type { MutationCtx } from "../_generated/server";

/**
 * Transactional email through Resend (C-12 #2, C-14 #2, V-07 #1, password reset).
 *
 * Configuration lives in Convex environment variables:
 * - RESEND_API_KEY: without it, emails are skipped and logged, so the app
 *   still works in development.
 * - EMAIL_FROM: e.g. "Event Planner <hello@yourdomain.ca>". Until a domain is
 *   verified in Resend, only "onboarding@resend.dev" works, and only to the
 *   Resend account owner's address.
 * - APP_URL: the site's address, for links in emails.
 * - EMAIL_TEST_MODE=true: only deliver to Resend's test addresses.
 */
export const resend = new Resend(components.resend, {
  testMode: process.env.EMAIL_TEST_MODE === "true",
});

export const appUrl = () => (process.env.APP_URL ?? "https://event-planner-app-woad.vercel.app").replace(/\/$/, "");

const escape = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export async function sendEmail(
  ctx: MutationCtx,
  to: string,
  message: { subject: string; heading: string; body?: string; cta?: { label: string; href: string }; footnote?: string },
) {
  if (!process.env.RESEND_API_KEY) {
    console.log(`[email skipped: RESEND_API_KEY not set] to=${to} subject="${message.subject}"`);
    return null;
  }
  const link = message.cta ? (message.cta.href.startsWith("http") ? message.cta.href : `${appUrl()}${message.cta.href}`) : null;
  const html = `<!doctype html><html><body style="margin:0;background:#F6F3EE;font-family:'Plus Jakarta Sans',Arial,sans-serif;color:#0E1A2F">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#FFFFFF;border-radius:20px;overflow:hidden">
<tr><td style="background:#0E1A2F;padding:20px 28px;font-family:Georgia,serif;font-size:22px;font-weight:bold;color:#FFFFFF">Event Planner</td></tr>
<tr><td style="padding:28px">
<h1 style="margin:0 0 12px;font-size:22px;line-height:1.3">${escape(message.heading)}</h1>
${message.body ? `<p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#5F6475;white-space:pre-line">${escape(message.body)}</p>` : ""}
${link ? `<a href="${escape(link)}" style="display:inline-block;background:#E3BE84;color:#0E1A2F;text-decoration:none;font-weight:bold;font-size:15px;padding:12px 24px;border-radius:999px">${escape(message.cta!.label)}</a>` : ""}
${message.footnote ? `<p style="margin:24px 0 0;font-size:13px;line-height:1.5;color:#5F6475">${escape(message.footnote)}</p>` : ""}
</td></tr></table>
<p style="font-size:12px;color:#8C8577;margin-top:16px">You're getting this because you have an Event Planner account.</p>
</td></tr></table></body></html>`;
  const text = [message.heading, message.body, link ? `${message.cta!.label}: ${link}` : null, message.footnote]
    .filter(Boolean)
    .join("\n\n");
  return await resend.sendEmail(ctx, {
    from: process.env.EMAIL_FROM ?? "Event Planner <onboarding@resend.dev>",
    to,
    subject: message.subject,
    html,
    text,
  });
}
