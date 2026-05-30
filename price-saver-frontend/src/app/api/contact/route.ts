import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

// Server-route env (no NEXT_PUBLIC_ prefix needed — this file runs server-side only).
// SUPPORT_EMAIL is the inbox that receives contact-form submissions.
// RESEND_FROM is the verified "From" address (e.g. 'Campify <noreply@your-domain>').
const SUPPORT_INBOX =
  (process.env.SUPPORT_EMAIL || process.env.NEXT_PUBLIC_SUPPORT_EMAIL || "").trim();
const RESEND_FROM = (process.env.RESEND_FROM || "").trim();
const PUBLIC_APP_URL = (
  process.env.NEXT_PUBLIC_APP_URL ||
  process.env.APP_URL ||
  ""
).replace(/\/+$/, "");
const PUBLIC_DOMAIN = PUBLIC_APP_URL.replace(/^https?:\/\//, "");

export async function POST(req: NextRequest) {
  try {
    const { name, email, subject, message } = await req.json();

    if (!name || !email || !subject || !message) {
      return NextResponse.json(
        { error: "All fields are required" },
        { status: 400 }
      );
    }
    if (typeof message !== "string" || message.length < 20) {
      return NextResponse.json(
        { error: "Message must be at least 20 characters" },
        { status: 400 }
      );
    }

    if (!RESEND_FROM || !SUPPORT_INBOX) {
      console.error(
        "[contact] Missing env: RESEND_FROM and SUPPORT_EMAIL must be set"
      );
      return NextResponse.json(
        { error: "Email service is not configured. Please try again later." },
        { status: 500 }
      );
    }

    const safeName = String(name).slice(0, 120);
    const safeEmail = String(email).slice(0, 200);
    const safeSubject = String(subject).slice(0, 120);
    const safeMessage = String(message).slice(0, 5000);

    await resend.emails.send({
      from: RESEND_FROM,
      to: SUPPORT_INBOX,
      replyTo: safeEmail,
      subject: `[Campify Contact] ${safeSubject} — from ${safeName}`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: #2563eb; padding: 24px; border-radius: 8px 8px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 20px;">
              New Contact Form Submission
            </h1>
          </div>
          <div style="background: #f9fafb; padding: 24px; border-radius: 0 0 8px 8px; border: 1px solid #e5e7eb;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; color: #6b7280; width: 120px;">Name</td>
                <td style="padding: 8px 0; font-weight: 600; color: #111827;">${safeName}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #6b7280;">Email</td>
                <td style="padding: 8px 0; color: #111827;">
                  <a href="mailto:${safeEmail}" style="color: #2563eb;">${safeEmail}</a>
                </td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #6b7280;">Subject</td>
                <td style="padding: 8px 0; color: #111827;">${safeSubject}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #6b7280; vertical-align: top;">Message</td>
                <td style="padding: 8px 0; color: #111827; line-height: 1.6;">
                  ${safeMessage.replace(/\n/g, "<br>")}
                </td>
              </tr>
            </table>
            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 16px 0;">
            <p style="color: #9ca3af; font-size: 12px; margin: 0;">
              Sent from ${PUBLIC_DOMAIN ? `${PUBLIC_DOMAIN}/contact` : "the contact form"}
            </p>
          </div>
        </div>
      `,
    });

    await resend.emails.send({
      from: RESEND_FROM,
      to: safeEmail,
      subject: "We've received your message — Campify",
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: #2563eb; padding: 24px; border-radius: 8px 8px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 20px;">Thanks for reaching out!</h1>
          </div>
          <div style="background: #f9fafb; padding: 24px; border-radius: 0 0 8px 8px; border: 1px solid #e5e7eb;">
            <p style="color: #374151;">Hi ${safeName},</p>
            <p style="color: #374151; line-height: 1.6;">
              We've received your message about <strong>${safeSubject}</strong>
              and will get back to you within 24 hours.
            </p>
            ${
              PUBLIC_APP_URL
                ? `<p style="color: #374151; line-height: 1.6;">
              In the meantime, you can find answers to common questions
              at our <a href="${PUBLIC_APP_URL}/help" style="color: #2563eb;">Help Centre</a>.
            </p>`
                : ""
            }
            <p style="color: #374151;">
              Best regards,<br>
              <strong>The Campify Team</strong>
            </p>
            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 16px 0;">
            <p style="color: #9ca3af; font-size: 12px;">
              Campify · UNILAG Campus, Yaba, Lagos${
                PUBLIC_APP_URL
                  ? ` · <a href="${PUBLIC_APP_URL}" style="color: #9ca3af;">${PUBLIC_DOMAIN}</a>`
                  : ""
              }
            </p>
          </div>
        </div>
      `,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Contact form error:", error);
    return NextResponse.json(
      { error: "Failed to send message. Please try again." },
      { status: 500 }
    );
  }
}
