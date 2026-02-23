import { baseLayout, escHtml, allowUrl } from "./_base";

export interface MentionEmailOptions {
  mentionedUserName: string;
  mentionedUserEmail: string;
  mentionerName: string;
  cardTitle: string;
  boardTitle: string;
  cardUrl: string;
}

export function render(opts: MentionEmailOptions): string {
  const content = `
    <p style="font-size:18px;font-weight:600;margin-bottom:16px;">You were mentioned 👋</p>
    <p>Hi ${escHtml(opts.mentionedUserName)},</p>
    <p style="margin-top:12px;">
      <strong>${escHtml(opts.mentionerName)}</strong> mentioned you in a comment on
      the card <strong>"${escHtml(opts.cardTitle)}"</strong> on board
      <strong>"${escHtml(opts.boardTitle)}"</strong>.
    </p>
    <a href="${allowUrl(opts.cardUrl)}" class="cta">View Card →</a>
  `;
  // escHtml prevents HTML injection in the <title> element rendered by baseLayout
  return baseLayout(content, `${escHtml(opts.mentionerName)} mentioned you in "${escHtml(opts.cardTitle)}"`);
}
