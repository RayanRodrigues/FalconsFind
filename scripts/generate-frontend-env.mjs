import fs from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();
const envPath = path.join(rootDir, '.env');
const examplePath = path.join(rootDir, '.env.example');
const outPath = path.join(rootDir, 'frontend', 'public', 'env.js');

let sourcePath = envPath;

if (!fs.existsSync(envPath)) {
  if (fs.existsSync(examplePath)) {
    if (process.env.CI) {
      console.warn('Missing .env in project root. Using .env.example for CI.');
      sourcePath = examplePath;
    } else {
      console.error('Missing .env in project root. Copy .env.example to .env.');
      process.exit(1);
    }
  } else if (process.env.CI) {
    console.warn('Missing .env and .env.example. Generating empty env.js for CI.');
    fs.writeFileSync(outPath, 'window.__env = {};');
    process.exit(0);
  } else {
    console.error('Missing .env in project root.');
    process.exit(1);
  }
}

const raw = fs.readFileSync(sourcePath, 'utf8');
const env = {};

for (const line of raw.split(/\r?\n/)) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const index = trimmed.indexOf('=');
  if (index === -1) continue;
  const key = trimmed.slice(0, index).trim();
  let value = trimmed.slice(index + 1).trim();
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1);
  }
  value = value.replace(/\\n/g, '\n');
  env[key] = value;
}

const publicKeys = [
  'APP_ENV',
  'API_BASE_URL',
  'API_BASE_URL_DEV',
  'API_BASE_URL_PROD',
  'API_PREFIX',
  'ENABLE_FIREBASE_HEALTH_TEST',
  'FIREBASE_API_KEY',
  'FIREBASE_AUTH_DOMAIN',
  'FIREBASE_PROJECT_ID',
  'FIREBASE_STORAGE_BUCKET',
  'FIREBASE_MESSAGING_SENDER_ID',
  'FIREBASE_APP_ID',
  'FIREBASE_MEASUREMENT_ID',
];

const resolveAppEnv = () => {
  const raw = (process.env.APP_ENV ?? process.env.NODE_ENV ?? env.APP_ENV ?? 'development')
    .toLowerCase();
  return raw === 'production' ? 'production' : 'development';
};

const resolveApiBaseUrl = (appEnv) => {
  if (process.env.API_BASE_URL || env.API_BASE_URL) {
    return process.env.API_BASE_URL ?? env.API_BASE_URL;
  }

  if (appEnv === 'production') {
    return (
      process.env.API_BASE_URL_PROD ??
      env.API_BASE_URL_PROD ??
      'https://falconsfind.onrender.com'
    );
  }

  return process.env.API_BASE_URL_DEV ?? env.API_BASE_URL_DEV ?? 'http://localhost:3000';
};

const appEnv = resolveAppEnv();
const publicEnv = {};
for (const key of publicKeys) {
  // Build/runtime environment variables override .env values (useful for Render/CI).
  const value = process.env[key] ?? env[key];
  if (value) {
    publicEnv[key] = value;
  }
}
publicEnv.APP_ENV = appEnv;
publicEnv.API_BASE_URL = resolveApiBaseUrl(appEnv);
publicEnv.API_PREFIX = process.env.API_PREFIX ?? env.API_PREFIX ?? '/api/v1';

const output = `window.__env = ${JSON.stringify(publicEnv, null, 2)};`;
fs.writeFileSync(outPath, output);
console.log(`Generated ${path.relative(rootDir, outPath)}`);
