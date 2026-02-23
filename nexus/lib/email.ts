import { Resend } from "resend";
import { logger } from "@/lib/logger";

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

export async function sendMentionEmail(opts: {
  mentionedUserEmail: string;
  mentionedUserName: string;
  mentionerName: string;
  cardTitle: string;
  boardTitle: string;
  cardUrl: string;
}) {
  return sendEmail({
    to: opts.mentionedUserEmail,
    subject: `${opts.mentionerName} mentioned you in "${opts.cardTitle}"`,
    html: mentionEmailHtml(opts),
    text: `${opts.mentionerName} mentioned you in the card "${opts.cardTitle}" on board "${opts.boardTitle}". View card: ${opts.cardUrl}`,
  });
}

export async function sendDueDateReminderEmail(opts: {
  userEmail: string;
  userName: string;
  cardTitle: string;
  boardTitle: string;
  dueDate: Date;
  cardUrl: string;
}) {
  const formattedDate = opts.dueDate.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  });

  return sendEmail({
    to: opts.userEmail,
    subject: `Reminder: "${opts.cardTitle}" is due soon`,
    html: dueDateEmailHtml({ ...opts, formattedDate }),
    text: `Your card "${opts.cardTitle}" on "${opts.boardTitle}" is due on ${formattedDate}. View: ${opts.cardUrl}`,
  });
}

export async function sendWeeklyDigestEmail(opts: {
  userEmail: string;
  userName: string;
  stats: {
    cardsCreated: number;
    cardsCompleted: number;
    overdueCards: number;
    activeBoards: number;
  };
  appUrl: string;
}) {
  return sendEmail({
    to: opts.userEmail,
    subject: "Your Nexus weekly summary",
    html: weeklyDigestHtml(opts),
    text: `Hi ${opts.userName}, here's your weekly summary: ${opts.stats.cardsCreated} cards created, ${opts.stats.cardsCompleted} completed, ${opts.stats.overdueCards} overdue.`,
  });
}

// ─── HTML templates ───────────────────────────────────────────────────────────

function baseLayout(content: string, previewText: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escHtml(previewText)}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f4f4f5; color: #18181b; }
    .wrapper { max-width: 600px; margin: 32px auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    .header { background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); padding: 32px 40px; }
    .header h1 { color: #ffffff; font-size: 24px; font-weight: 700; letter-spacing: -0.5px; }
    .header p { color: rgba(255,255,255,0.8); font-size: 14px; margin-top: 4px; }
    .body { padding: 40px; }
    .cta { display: inline-block; background: #6366f1; color: #ffffff !important; padding: 12px 24px; border-radius: 8px; font-weight: 600; font-size: 14px; text-decoration: none; margin-top: 24px; }
    .footer { padding: 24px 40px; background: #f4f4f5; text-align: center; font-size: 12px; color: #71717a; }
    .stat-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; margin: 24px 0; }
    .stat-card { background: #f4f4f5; border-radius: 8px; padding: 16px; text-align: center; }
    .stat-value { font-size: 28px; font-weight: 700; color: #6366f1; }
    .stat-label { font-size: 12px; color: #71717a; margin-top: 4px; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <h1>Nexus</h1>
      <p>Project management, simplified</p>
    </div>
    <div class="body">${content}</div>
    <div class="footer">
      <p>You're receiving this because you have an account on Nexus.</p>
      <p style="margin-top:8px;">© ${new Date().getFullYear()} Nexus. All rights reserved.</p>
    </div>
  </div>
</body>
</html>`;
}

function mentionEmailHtml(opts: {
  mentionedUserName: string;
  mentionerName: string;
  cardTitle: string;
  boardTitle: string;
  cardUrl: string;
}): string {
  const content = `
    <p style="font-size:18px;font-weight:600;margin-bottom:16px;">You were mentioned 👋</p>
    <p>Hi ${escHtml(opts.mentionedUserName)},</p>
    <p style="margin-top:12px;"><strong>${escHtml(opts.mentionerName)}</strong> mentioned you in a comment on the card <strong>"${escHtml(opts.cardTitle)}"</strong> on board <strong>"${escHtml(opts.boardTitle)}"</strong>.</p>
    <a href="${escHtml(allowUrl(opts.cardUrl))}" class="cta">View Card →</a>
  `;
  return baseLayout(content, `${opts.mentionerName} mentioned you`);
}

function dueDateEmailHtml(opts: {
  userName: string;
  cardTitle: string;
  boardTitle: string;
  formattedDate: string;
  cardUrl: string;
}): string {
  const content = `
    <p style="font-size:18px;font-weight:600;margin-bottom:16px;">Due date reminder ⏰</p>
    <p>Hi ${escHtml(opts.userName)},</p>
    <p style="margin-top:12px;">The card <strong>"${escHtml(opts.cardTitle)}"</strong> on board <strong>"${escHtml(opts.boardTitle)}"</strong> is due on <strong>${escHtml(opts.formattedDate)}</strong>.</p>
    <a href="${escHtml(allowUrl(opts.cardUrl))}" class="cta">View Card →</a>
  `;
  return baseLayout(content, `Reminder: ${opts.cardTitle}`);
}

function weeklyDigestHtml(opts: {
  userName: string;
  stats: { cardsCreated: number; cardsCompleted: number; overdueCards: number; activeBoards: number };
  appUrl: string;
}): string {
  const { stats } = opts;
  const content = `
    <p style="font-size:18px;font-weight:600;margin-bottom:16px;">Your weekly summary 📊</p>
    <p>Hi ${escHtml(opts.userName)}, here's what happened in your workspace this week:</p>
    <div class="stat-grid">
      <div class="stat-card"><div class="stat-value">${stats.cardsCreated}</div><div class="stat-label">Cards Created</div></div>
      <div class="stat-card"><div class="stat-value">${stats.cardsCompleted}</div><div class="stat-label">Cards Completed</div></div>
      <div class="stat-card"><div class="stat-value">${stats.overdueCards}</div><div class="stat-label">Overdue</div></div>
      <div class="stat-card"><div class="stat-value">${stats.activeBoards}</div><div class="stat-label">Active Boards</div></div>
    </div>
    <a href="${escHtml(allowUrl(opts.appUrl))}/dashboard" class="cta">Open Dashboard →</a>
  `;
  return baseLayout(content, "Your Nexus weekly summary");
}

function escHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Allow only https:// and http:// URLs in email hrefs; fall back to '#' for anything suspicious. */
function allowUrl(url: string): string {
  try {
    const parsed = new URL(url);
    if (parsed.protocol === "https:" || parsed.protocol === "http:") return url;
  } catch {
    // not a valid URL
  }
  return "#";
}
