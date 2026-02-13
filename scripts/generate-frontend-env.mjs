import fs from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();
const envPath = path.join(rootDir, '.env');
const outPath = path.join(rootDir, 'frontend', 'public', 'env.js');

if (!fs.existsSync(envPath)) {
  console.error('Missing .env in project root.');
  process.exit(1);
}

const raw = fs.readFileSync(envPath, 'utf8');
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
  'API_BASE_URL',
  'ENABLE_FIREBASE_HEALTH_TEST',
  'FIREBASE_API_KEY',
  'FIREBASE_AUTH_DOMAIN',
  'FIREBASE_PROJECT_ID',
  'FIREBASE_STORAGE_BUCKET',
  'FIREBASE_MESSAGING_SENDER_ID',
  'FIREBASE_APP_ID',
  'FIREBASE_MEASUREMENT_ID',
];

const publicEnv = {};
for (const key of publicKeys) {
  if (env[key]) {
    publicEnv[key] = env[key];
  }
}

const output = `window.__env = ${JSON.stringify(publicEnv, null, 2)};`;
fs.writeFileSync(outPath, output);
console.log(`Generated ${path.relative(rootDir, outPath)}`);
