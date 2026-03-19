import admin from 'firebase-admin';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadEnvironment } from '../src/bootstrap/runtime-paths.js';
import { initializeFirebaseServices } from '../src/bootstrap/firebase.js';
import { UserRole } from '../src/contracts/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
loadEnvironment(path.resolve(__dirname, '..'));

const parseArg = (name: string): string | null => {
  const flag = `--${name}`;
  const index = process.argv.indexOf(flag);
  if (index === -1) {
    return null;
  }

  return process.argv[index + 1]?.trim() || null;
};

const email = parseArg('email') || process.env.ADMIN_USER_EMAIL?.trim() || '';
const password = parseArg('password') || process.env.ADMIN_USER_PASSWORD?.trim() || '';
const roleRaw = parseArg('role') || process.env.ADMIN_USER_ROLE?.trim() || UserRole.ADMIN;
const role = roleRaw === UserRole.SECURITY ? UserRole.SECURITY : UserRole.ADMIN;

if (!email || !password) {
  console.error('Usage: npm run admin:provision -- --email <email> --password <password> [--role ADMIN|SECURITY]');
  process.exit(1);
}

const { db } = initializeFirebaseServices(path.resolve(__dirname, '..'));

const existingUser = await admin.auth().getUserByEmail(email).catch((error: { code?: string }) => {
  if (error.code === 'auth/user-not-found') {
    return null;
  }

  throw error;
});

const userRecord = existingUser
  ? await admin.auth().updateUser(existingUser.uid, { email, password, emailVerified: true, disabled: false })
  : await admin.auth().createUser({ email, password, emailVerified: true, disabled: false });

await admin.auth().setCustomUserClaims(userRecord.uid, { role });
await db.collection('users').doc(userRecord.uid).set(
  {
    email,
    role,
    updatedAt: new Date().toISOString(),
  },
  { merge: true },
);

console.log(`Admin user provisioned: ${email} (${role}) uid=${userRecord.uid}`);
