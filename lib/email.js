import nodemailer from "nodemailer";
import { Resend } from "resend";

// Two supported senders — pick whichever is configured. SMTP (e.g. Gmail +
// an App Password) is the easiest way to test with real, arbitrary
// recipient addresses without verifying a domain first. Resend is the
// better choice once you're ready to go live (works reliably on
// serverless hosts where outbound SMTP ports are often blocked).
// If neither is configured, mail is logged to the console instead of sent.
//
// SMTP_HOST / SMTP_PORT / SMTP_USER / SMTP_PASS / SMTP_FROM — e.g. Gmail:
//   smtp.gmail.com : 587, your Gmail address, a 16-char App Password
// RESEND_API_KEY / RESEND_FROM — get a free key at https://resend.com

const transporter =
  process.env.SMTP_HOST &&
  nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    // Some networks (common on Windows/home routers) have broken or
    // partial IPv6 — the TCP handshake succeeds over IPv6 but the larger
    // TLS handshake packets get silently dropped, producing "socket
    // disconnected before secure TLS connection was established". Forcing
    // IPv4 avoids that path entirely.
    family: 4,
  });

const resend = !transporter && process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

if (!transporter && !resend) {
  if (process.env.NODE_ENV === "production") {
    throw new Error("No email provider configured (SMTP_HOST or RESEND_API_KEY). Refusing to start in production without one — see .env.local.example.");
  }
  console.warn("WARNING: no email provider configured. Emails will be logged to the console instead of sent.");
}

export async function sendMail(to, subject, html) {
  if (transporter) {
    await transporter.sendMail({ from: process.env.SMTP_FROM, to, subject, html });
    return;
  }
  if (resend) {
    const { error } = await resend.emails.send({
      from: process.env.RESEND_FROM || "onboarding@resend.dev",
      to,
      subject,
      html,
    });
    if (error) throw new Error(`Resend send failed: ${error.message || error}`);
    return;
  }
  // Local-dev-only fallback so the app still runs without any provider —
  // the magic link is printed to the terminal running `npm run dev`.
  console.log(`[dev email — no provider configured] to=${to} subject="${subject}"\n${html}`);
}
