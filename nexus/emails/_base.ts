// ─── Shared email utilities ───────────────────────────────────────────────────

/** Escape HTML entities in user-supplied strings */
export function escHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Allow only http/https URLs; fall back to '#' for anything suspicious.
 * Returns the canonicalized href from the URL object (not the raw input)
 * to prevent smuggled control characters or encoding tricks.
 */
export function allowUrl(url: string): string {
  try {
    const parsed = new URL(url);
    if (parsed.protocol === "https:" || parsed.protocol === "http:") return parsed.href;
  } catch {
    // not a valid URL
  }
  return "#";
}

/** Renders the outer branded email chrome */
export function baseLayout(content: string, previewText: string): string {
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
    .badge { display: inline-block; padding: 4px 10px; border-radius: 999px; font-size: 12px; font-weight: 600; }
    .badge-purple { background: #ede9fe; color: #7c3aed; }
    .divider { border: none; border-top: 1px solid #e4e4e7; margin: 24px 0; }
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
