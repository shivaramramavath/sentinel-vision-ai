/**
 * Base layout for Sentinel Vision AI system emails.
 * High-contrast, minimal, black/white shadcn aesthetic.
 * Responsive, zero external tracking pixels, safe HTML escaping.
 */

export function escapeHtml(unsafe: string | number | undefined | null): string {
  if (unsafe === undefined || unsafe === null) return '';
  return String(unsafe)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export interface RenderedTemplate {
  subject: string;
  htmlContent: string;
  textContent: string;
}

export function wrapInBaseLayout(options: {
  title: string;
  preheader: string;
  bodyContent: string;
  textContent: string;
}): RenderedTemplate {
  const { title, preheader, bodyContent, textContent } = options;

  const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      background-color: #09090b;
      color: #fafafa;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      -webkit-font-smoothing: antialiased;
    }
    table { border-collapse: collapse; }
    .container {
      width: 100%;
      max-width: 580px;
      margin: 0 auto;
      padding: 40px 20px;
    }
    .card {
      background-color: #18181b;
      border: 1px solid #27272a;
      border-radius: 8px;
      padding: 32px;
    }
    .brand-header {
      padding-bottom: 24px;
      border-bottom: 1px solid #27272a;
      margin-bottom: 24px;
    }
    .brand-title {
      font-size: 16px;
      font-weight: 700;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      color: #ffffff;
      margin: 0;
    }
    .brand-subtitle {
      font-size: 11px;
      color: #a1a1aa;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin: 4px 0 0 0;
    }
    .heading {
      font-size: 20px;
      font-weight: 600;
      color: #ffffff;
      margin: 0 0 16px 0;
    }
    .text {
      font-size: 14px;
      line-height: 1.6;
      color: #d4d4d8;
      margin: 0 0 16px 0;
    }
    .meta-box {
      background-color: #09090b;
      border: 1px solid #27272a;
      border-radius: 6px;
      padding: 16px;
      margin: 20px 0;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 12px;
      color: #a1a1aa;
      line-height: 1.6;
    }
    .meta-row {
      display: flex;
      justify-content: space-between;
      margin-bottom: 6px;
    }
    .btn {
      display: inline-block;
      background-color: #ffffff;
      color: #09090b !important;
      font-weight: 600;
      font-size: 14px;
      padding: 12px 24px;
      border-radius: 6px;
      text-decoration: none;
      margin: 16px 0;
    }
    .btn-danger {
      background-color: #ef4444;
      color: #ffffff !important;
    }
    .footer {
      padding-top: 24px;
      border-top: 1px solid #27272a;
      margin-top: 32px;
      font-size: 11px;
      color: #71717a;
      line-height: 1.5;
    }
    .preheader {
      display: none !important;
      visibility: hidden;
      mso-hide: all;
      font-size: 1px;
      color: #09090b;
      line-height: 1px;
      max-height: 0;
      max-width: 0;
      opacity: 0;
      overflow: hidden;
    }
  </style>
</head>
<body>
  <span class="preheader">${escapeHtml(preheader)}</span>
  <div class="container">
    <div class="card">
      <div class="brand-header">
        <h1 class="brand-title">SENTINEL VISION AI</h1>
        <p class="brand-subtitle">Automated Security & Surveillance Command</p>
      </div>

      ${bodyContent}

      <div class="footer">
        <p>This automated security transmission was dispatched by Sentinel Vision AI platform.<br>
        If you did not authorize this action, please alert your systems supervisor immediately.</p>
        <p>&copy; ${new Date().getFullYear()} SENTINEL VISION AI · System Integrity Enforced</p>
      </div>
    </div>
  </div>
</body>
</html>`;

  const fullText = `=== SENTINEL VISION AI ===\n${title}\n\n${textContent}\n\n----------------------------------------\nThis is an automated system transmission. If you did not authorize this request, alert your security supervisor.\n© ${new Date().getFullYear()} SENTINEL VISION AI`;

  return {
    subject: title,
    htmlContent,
    textContent: fullText,
  };
}
