import { baseLayout, escHtml, allowUrl } from "./_base";

export interface DigestEmailOptions {
  userEmail: string;
  userName: string;
  stats: {
    cardsCreated: number;
    cardsCompleted: number;
    overdueCards: number;
    activeBoards: number;
  };
  topCards?: Array<{ title: string; boardTitle: string; url: string }>;
  appUrl: string;
}

export function render(opts: DigestEmailOptions): string {
  const { stats } = opts;

  const topCardRows =
    opts.topCards && opts.topCards.length > 0
      ? `
    <hr class="divider" />
    <p style="font-weight:600;margin-bottom:12px;">Cards needing attention:</p>
    <ul style="padding-left:0;list-style:none;margin:0;">
      ${opts.topCards
        .slice(0, 5)
        .map(
          (c) => `
        <li style="padding:8px 0;border-bottom:1px solid #f4f4f5;">
          <a href="${allowUrl(c.url)}" style="color:#6366f1;text-decoration:none;font-weight:600;">${escHtml(c.title)}</a>
          <span style="color:#71717a;font-size:12px;margin-left:8px;">${escHtml(c.boardTitle)}</span>
        </li>
      `
        )
        .join("")}
    </ul>
  `
      : "";

  const content = `
    <p style="font-size:18px;font-weight:600;margin-bottom:16px;">Your weekly summary 📊</p>
    <p>Hi ${escHtml(opts.userName)}, here's what happened in your workspace this week:</p>
    <div class="stat-grid" style="margin-top:20px;">
      <div class="stat-card">
        <div class="stat-value">${stats.cardsCreated}</div>
        <div class="stat-label">Cards Created</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${stats.cardsCompleted}</div>
        <div class="stat-label">Cards Completed</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${stats.overdueCards}</div>
        <div class="stat-label">Overdue</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${stats.activeBoards}</div>
        <div class="stat-label">Active Boards</div>
      </div>
    </div>
    ${topCardRows}
    <a href="${allowUrl(opts.appUrl)}/dashboard" class="cta">Open Dashboard →</a>
  `;
  return baseLayout(content, "Your Nexus weekly summary");
}
