import { baseLayout, escHtml, allowUrl } from "./_base";

export interface AssignedEmailOptions {
  assigneeEmail: string;
  assigneeName: string;
  assignerName: string;
  cardTitle: string;
  boardTitle: string;
  listTitle: string;
  cardUrl: string;
  dueDate?: Date | null;
}

export function render(opts: AssignedEmailOptions): string {
  const dueLine = opts.dueDate
    ? `<p style="margin-top:8px;color:#71717a;font-size:14px;">
         Due: <strong>${escHtml(opts.dueDate.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }))}</strong>
       </p>`
    : "";

  const content = `
    <p style="font-size:18px;font-weight:600;margin-bottom:16px;">You've been assigned a card 🎯</p>
    <p>Hi ${escHtml(opts.assigneeName)},</p>
    <p style="margin-top:12px;">
      <strong>${escHtml(opts.assignerName)}</strong> assigned you to the card
      <strong>"${escHtml(opts.cardTitle)}"</strong> in list
      <strong>"${escHtml(opts.listTitle)}"</strong> on board
      <strong>"${escHtml(opts.boardTitle)}"</strong>.
    </p>
    ${dueLine}
    <a href="${allowUrl(opts.cardUrl)}" class="cta">View Card →</a>
  `;
  return baseLayout(content, `You've been assigned "${opts.cardTitle}"`);
}
