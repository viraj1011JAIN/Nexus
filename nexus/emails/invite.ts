import { baseLayout, escHtml, allowUrl } from "./_base";

export interface InviteEmailOptions {
  inviteeEmail: string;
  inviteeName?: string;
  inviterName: string;
  orgName: string;
  inviteUrl: string;
  expiresInHours?: number;
}

export function render(opts: InviteEmailOptions): string {
  const greeting = opts.inviteeName ? `Hi ${escHtml(opts.inviteeName)},` : "Hi there,";
  const expiryNote = opts.expiresInHours
    ? `<p style="margin-top:16px;color:#71717a;font-size:13px;">This invitation expires in ${opts.expiresInHours} hours.</p>`
    : "";

  const content = `
    <p style="font-size:18px;font-weight:600;margin-bottom:16px;">You're invited to join Nexus 🎉</p>
    <p>${greeting}</p>
    <p style="margin-top:12px;">
      <strong>${escHtml(opts.inviterName)}</strong> has invited you to join the workspace
      <strong>"${escHtml(opts.orgName)}"</strong> on Nexus.
    </p>
    <p style="margin-top:12px;color:#52525b;font-size:14px;">
      Nexus helps teams plan, track, and ship projects together. Accept the invitation below to get started.
    </p>
    <a href="${allowUrl(opts.inviteUrl)}" class="cta">Accept Invitation →</a>
    ${expiryNote}
    <hr style="margin-top:32px;border:none;border-top:1px solid #e4e4e7;" />
    <p style="margin-top:16px;font-size:12px;color:#71717a;">
      If you weren't expecting this invitation, you can safely ignore this email.
      If you have concerns, contact us at support@nexus.app
    </p>
  `;
  // escHtml prevents HTML injection in the <title> element rendered by baseLayout
  return baseLayout(content, `${escHtml(opts.inviterName)} invited you to ${escHtml(opts.orgName)}`);
}
