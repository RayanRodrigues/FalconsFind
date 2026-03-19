import {
  AngularNodeAppEngine,
  createNodeRequestHandler,
  isMainModule,
} from '@angular/ssr/node';
import express from 'express';
import { randomBytes } from 'node:crypto';
import { join } from 'node:path';

const browserDistFolder = join(import.meta.dirname, '../browser');

const app = express();
const angularApp = new AngularNodeAppEngine();

const createCspNonce = (): string => randomBytes(16).toString('base64');

const resolveAppEnv = (): 'development' | 'production' => {
  const raw = (process.env['APP_ENV'] ?? process.env['NODE_ENV'] ?? 'development').toLowerCase();
  return raw === 'production' ? 'production' : 'development';
};

const resolveApiBaseUrl = (appEnv: 'development' | 'production'): string => {
  if (process.env['API_BASE_URL']) {
    return process.env['API_BASE_URL'];
  }

  if (appEnv === 'production') {
    return process.env['API_BASE_URL_PROD'] ?? 'https://falconsfind.onrender.com';
  }

  return process.env['API_BASE_URL_DEV'] ?? 'http://localhost:3000';
};

const resolveAllowedConnectSources = (): string[] => {
  const allowed = new Set<string>(["'self'"]);
  const appEnv = resolveAppEnv();

  try {
    allowed.add(new URL(resolveApiBaseUrl(appEnv)).origin);
  } catch {
    // Ignore malformed API base URL here; the frontend has its own guardrails.
  }

  allowed.add('https://vitals.vercel-insights.com');
  return Array.from(allowed);
};

const buildContentSecurityPolicy = (nonce: string): string => [
  "default-src 'self'",
  "base-uri 'self'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "object-src 'none'",
  `script-src 'self' 'nonce-${nonce}'`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https://storage.googleapis.com https://firebasestorage.googleapis.com",
  "font-src 'self' data:",
  `connect-src ${resolveAllowedConnectSources().join(' ')}`,
  "frame-src 'none'",
  resolveAppEnv() === 'production' ? 'upgrade-insecure-requests' : '',
].filter(Boolean).join('; ');

const applyHtmlCspCompatibility = (html: string, nonce: string): string => {
  return html
    .replace(/ media="print" onload="this\.media='all'"/gi, '')
    .replace(/<script(?![^>]*\bnonce=)([^>]*)>/gi, (_match, attrs: string) => {
      const normalizedAttrs = attrs ?? '';
      return `<script nonce="${nonce}"${normalizedAttrs}>`;
    });
};

app.use((req, res, next) => {
  const nonce = createCspNonce();
  res.locals['cspNonce'] = nonce;
  res.setHeader('Content-Security-Policy', buildContentSecurityPolicy(nonce));
  next();
});

app.use(
  express.static(browserDistFolder, {
    maxAge: '1y',
    index: false,
    redirect: false,
  }),
);

/**
 * Handle all other requests by rendering the Angular application.
 */
app.use((req, res, next) => {
  angularApp
    .handle(req)
    .then(async (response) => {
      if (!response) {
        next();
        return;
      }

      const contentType = response.headers.get('content-type') ?? '';
      if (!contentType.includes('text/html')) {
        response.headers.forEach((value, key) => {
          res.setHeader(key, value);
        });
        res.status(response.status);
        const body = Buffer.from(await response.arrayBuffer());
        res.send(body);
        return;
      }

      const nonce = String(res.locals['cspNonce'] ?? '');
      const html = applyHtmlCspCompatibility(await response.text(), nonce);
      response.headers.forEach((value, key) => {
        if (key.toLowerCase() === 'content-length') {
          return;
        }
        res.setHeader(key, value);
      });
      res.status(response.status).send(html);
    })
    .catch(next);
});

/**
 * Start the server if this module is the main entry point, or it is ran via PM2.
 * The server listens on the port defined by the `PORT` environment variable, or defaults to 4000.
 */
if (isMainModule(import.meta.url) || process.env['pm_id']) {
  const port = process.env['PORT'] || 4000;
  app.listen(port, (error) => {
    if (error) {
      throw error;
    }

    console.log(`Node Express server listening on http://localhost:${port}`);
  });
}

/**
 * Request handler used by the Angular CLI (for dev-server and during build) or Firebase Cloud Functions.
 */
export const reqHandler = createNodeRequestHandler(app);
