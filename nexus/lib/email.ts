import { Resend } from "resend";
import { logger } from "@/lib/logger";
import * as MentionEmail from "@/emails/mention";
import * as AssignedEmail from "@/emails/assigned";
import * as DueSoonEmail from "@/emails/due-soon";
import * as DigestEmail from "@/emails/digest";
import * as InviteEmail from "@/emails/invite";

// Lazy-initialise so the module can be imported without a key at build time
let _resend: Resend | null = null;

function getResend(): Resend {
  if (!_resend) {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      throw new Error("RESEND_API_KEY is not configured");
    }
    _resend = new Resend(apiKey);
  }
  return _resend;
}

const FROM = process.env.EMAIL_FROM ?? "Nexus <notifications@nexus.app>";

// ─── Generic send helper ─────────────────────────────────────────────────────

interface SendEmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
}

export async function sendEmail(opts: SendEmailOptions): Promise<{ id?: string; error?: string }> {
  try {
    const resend = getResend();
    const result = await resend.emails.send({
      from: FROM,
      to: Array.isArray(opts.to) ? opts.to : [opts.to],
      subject: opts.subject,
      html: opts.html,
      ...(opts.text ? { text: opts.text } : {}),
    });

    if (result.error) {
      logger.error("Failed to send email", { error: result.error, to: opts.to });
      return { error: result.error.message };
    }

    logger.info("Email sent", { id: result.data?.id, to: opts.to, subject: opts.subject });
    return { id: result.data?.id };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Email send failed";
    logger.error("Email exception", { error: msg });
    return { error: msg };
  }
}

// ─── Notification helpers ─────────────────────────────────────────────────────

export async function sendMentionEmail(opts: MentionEmail.MentionEmailOptions) {
  return sendEmail({
    to: opts.mentionedUserEmail,
    subject: `${opts.mentionerName} mentioned you in "${opts.cardTitle}"`,
    html: MentionEmail.render(opts),
    text: `${opts.mentionerName} mentioned you in the card "${opts.cardTitle}" on board "${opts.boardTitle}". View card: ${opts.cardUrl}`,
  });
}

export async function sendAssignedEmail(opts: AssignedEmail.AssignedEmailOptions) {
  return sendEmail({
    to: opts.assigneeEmail,
    subject: `You've been assigned "${opts.cardTitle}" on ${opts.boardTitle}`,
    html: AssignedEmail.render(opts),
    text: `${opts.assignerName} assigned you to "${opts.cardTitle}" in list "${opts.listTitle}" on board "${opts.boardTitle}". View: ${opts.cardUrl}`,
  });
}

export async function sendInviteEmail(opts: InviteEmail.InviteEmailOptions) {
  return sendEmail({
    to: opts.inviteeEmail,
    subject: `${opts.inviterName} invited you to join ${opts.orgName} on Nexus`,
    html: InviteEmail.render(opts),
    text: `${opts.inviterName} invited you to join "${opts.orgName}" on Nexus. Accept here: ${opts.inviteUrl}`,
  });
}

export async function sendDueDateReminderEmail(opts: DueSoonEmail.DueSoonEmailOptions) {
  return sendEmail({
    to: opts.userEmail,
    subject: `Reminder: "${opts.cardTitle}" is due soon`,
    html: DueSoonEmail.render(opts),
    text: `Your card "${opts.cardTitle}" on "${opts.boardTitle}" is due on ${opts.dueDate.toLocaleDateString()}. View: ${opts.cardUrl}`,
  });
}

export async function sendWeeklyDigestEmail(opts: DigestEmail.DigestEmailOptions) {
  return sendEmail({
    to: opts.userEmail,
    subject: "Your Nexus weekly summary",
    html: DigestEmail.render(opts),
    text: `Hi ${opts.userName}, here's your weekly summary: ${opts.stats.cardsCreated} cards created, ${opts.stats.cardsCompleted} completed, ${opts.stats.overdueCards} overdue.`,
  });
}

// ─── HTML templates ───────────────────────────────────────────────────────────
// All templates have been extracted to the emails/ directory.
// They are re-exported here for easy access from other modules if needed.
export { MentionEmail, AssignedEmail, DueSoonEmail, DigestEmail, InviteEmail };
