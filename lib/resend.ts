// Imported from server actions only. The `server-only` guard package is not installed, so the
// protection is the convention that no client module imports this file.
import { Resend } from "resend";

// With no API key the send reports failure without a network call, and the caller renders its
// retry state. The approval itself never depends on this result.
export async function sendEmail({
  to,
  subject,
  body,
}: {
  to: string;
  subject: string;
  body: string;
}): Promise<{ sent: boolean; reason?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  if (!apiKey || !from) {
    return { sent: false, reason: "Email sending is not configured: RESEND_API_KEY or RESEND_FROM_EMAIL is missing." };
  }
  // Optional: without it, replies go to the from address, whose domain may not receive mail.
  const replyTo = process.env.RESEND_REPLY_TO_EMAIL || undefined;

  const resend = new Resend(apiKey);
  const { error } = await resend.emails.send({ from, to, subject, text: body, replyTo });
  if (error) return { sent: false, reason: error.message };
  return { sent: true };
}
