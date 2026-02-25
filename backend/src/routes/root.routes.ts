import { Router } from 'express';

const buildRootLandingPage = (apiPrefix: string): string => {
  const docsPath = '/api/docs';

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>FalconFind API</title>
    <style>
      :root {
        --bg-a: #0f2f3a;
        --bg-b: #123f4c;
        --card: #f4f6f8;
        --text: #162127;
        --muted: #455a64;
        --accent: #b9375d;
        --accent-2: #8f2b48;
        --border: #d6dde2;
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        font-family: "Segoe UI", "Inter", system-ui, -apple-system, sans-serif;
        color: var(--text);
        min-height: 100vh;
        background:
          radial-gradient(1200px 700px at 0% 0%, rgba(255,255,255,0.08), transparent 60%),
          linear-gradient(135deg, var(--bg-a), var(--bg-b));
        display: grid;
        place-items: center;
        padding: 24px;
      }
      .shell {
        width: min(900px, 100%);
        border: 1px solid rgba(255,255,255,0.18);
        background: rgba(255,255,255,0.08);
        backdrop-filter: blur(8px);
        border-radius: 18px;
        padding: 14px;
      }
      .card {
        background: var(--card);
        border: 1px solid var(--border);
        border-radius: 14px;
        padding: 28px;
      }
      .badge {
        display: inline-block;
        font-size: 12px;
        font-weight: 700;
        letter-spacing: .08em;
        text-transform: uppercase;
        color: var(--accent);
        background: rgba(185, 55, 93, 0.12);
        border: 1px solid rgba(185, 55, 93, 0.25);
        border-radius: 999px;
        padding: 6px 10px;
      }
      h1 {
        margin: 14px 0 8px;
        font-size: clamp(30px, 5vw, 44px);
        line-height: 1.05;
      }
      p {
        margin: 0 0 18px;
        color: var(--muted);
        line-height: 1.6;
      }
      .row {
        display: grid;
        grid-template-columns: 1fr;
        gap: 12px;
        margin: 20px 0 26px;
      }
      .item {
        border: 1px solid var(--border);
        border-radius: 10px;
        background: #fff;
        padding: 12px 14px;
      }
      .item b {
        display: block;
        font-size: 13px;
        margin-bottom: 6px;
      }
      code {
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
        font-size: 13px;
      }
      .actions {
        display: flex;
        gap: 10px;
        flex-wrap: wrap;
      }
      .btn {
        appearance: none;
        border: 1px solid transparent;
        text-decoration: none;
        font-weight: 700;
        font-size: 14px;
        border-radius: 10px;
        padding: 10px 14px;
      }
      .btn-primary {
        color: #fff;
        background: linear-gradient(135deg, var(--accent), var(--accent-2));
      }
      .btn-secondary {
        color: var(--text);
        background: #fff;
        border-color: var(--border);
      }
      .foot {
        margin-top: 16px;
        font-size: 12px;
        color: var(--muted);
      }
      @media (min-width: 760px) {
        .row {
          grid-template-columns: repeat(3, 1fr);
        }
      }
    </style>
  </head>
  <body>
    <main class="shell">
      <section class="card">
        <span class="badge">FalconFind</span>
        <h1>Backend API is online</h1>
        <p>
          Welcome to the FalconFind API service. Use the endpoints below for health checks,
          reports, and item operations.
        </p>

        <div class="row">
          <div class="item">
            <b>API Prefix</b>
            <code>${apiPrefix}</code>
          </div>
          <div class="item">
            <b>Health</b>
            <code>${apiPrefix}/health</code>
          </div>
          <div class="item">
            <b>Swagger Docs</b>
            <code>${docsPath}</code>
          </div>
        </div>

        <div class="actions">
          <a class="btn btn-primary" href="${docsPath}">Open Swagger UI</a>
          <a class="btn btn-secondary" href="${apiPrefix}/health">Check Health Endpoint</a>
        </div>

        <p class="foot">FalconFind API · Node + Express · REST</p>
      </section>
    </main>
  </body>
</html>`;
};

export const createRootRouter = (apiPrefix: string): Router => {
  const router = Router();

  router.get('/', (_req, res) => {
    res.status(200).type('html').send(buildRootLandingPage(apiPrefix));
  });

  return router;
};
