import { baseLayout, escHtml, allowUrl } from "./_base";

export interface DueSoonEmailOptions {
  userEmail: string;
  userName: string;
  cardTitle: string;
  boardTitle: string;
  dueDate: Date;
  cardUrl: string;
}

export function render(opts: DueSoonEmailOptions): string {
  const formattedDate = opts.dueDate.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  });

  const now = new Date();
  const msUntilDue = opts.dueDate.getTime() - now.getTime();
  const hoursUntilDue = Math.round(msUntilDue / 36e5);
  const isOverdue = msUntilDue < 0;

  const urgencyLine = isOverdue
    ? `<p style="margin-top:8px;padding:8px 12px;background:#fee2e2;border-radius:6px;color:#dc2626;font-weight:600;font-size:14px;">⚠️ This card is overdue!</p>`
    : hoursUntilDue < 4
    ? `<p style="margin-top:8px;padding:8px 12px;background:#fef9c3;border-radius:6px;color:#ca8a04;font-weight:600;font-size:14px;">⚡ Due in ${hoursUntilDue} hour${hoursUntilDue === 1 ? "" : "s"}!</p>`
    : "";

  const content = `
    <p style="font-size:18px;font-weight:600;margin-bottom:16px;">Due date reminder ⏰</p>
    <p>Hi ${escHtml(opts.userName)},</p>
    <p style="margin-top:12px;">
      The card <strong>"${escHtml(opts.cardTitle)}"</strong> on board
      <strong>"${escHtml(opts.boardTitle)}"</strong> is due on
      <strong>${escHtml(formattedDate)}</strong>.
    </p>
    ${urgencyLine}
    <a href="${allowUrl(opts.cardUrl)}" class="cta">View Card →</a>
  `;
  return baseLayout(content, `Reminder: "${opts.cardTitle}" is due soon`);
}
