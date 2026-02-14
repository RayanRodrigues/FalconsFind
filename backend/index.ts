import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import cors from 'cors';
import fs from 'node:fs';
import admin from 'firebase-admin';
import { pathToFileURL } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const healthRoutesTsPath = path.resolve(__dirname, './src/routes/health.routes.ts');
const healthRoutesJsPath = path.resolve(__dirname, './src/routes/health.routes.js');
const reportsRoutesTsPath = path.resolve(__dirname, './src/routes/reports.routes.ts');
const reportsRoutesJsPath = path.resolve(__dirname, './src/routes/reports.routes.js');
const healthRoutesPath = fs.existsSync(healthRoutesTsPath) ? healthRoutesTsPath : healthRoutesJsPath;
const reportsRoutesPath = fs.existsSync(reportsRoutesTsPath) ? reportsRoutesTsPath : reportsRoutesJsPath;
const healthRoutesModule = (await import(pathToFileURL(healthRoutesPath).href)) as {
    createHealthRouter: (db: FirebaseFirestore.Firestore) => express.Router;
};
const reportsRoutesModule = (await import(pathToFileURL(reportsRoutesPath).href)) as {
    createReportsRouter: (
        db: FirebaseFirestore.Firestore,
        bucket: unknown,
    ) => express.Router;
};

const workspaceRootCandidates = [
    path.resolve(__dirname, '..'),
    path.resolve(__dirname, '../..'),
];
const resolveWorkspacePath = (targetPath: string): string => {
    if (path.isAbsolute(targetPath)) {
        return targetPath;
    }

    const existing = workspaceRootCandidates
        .map((basePath) => path.resolve(basePath, targetPath))
        .find((candidate) => fs.existsSync(candidate));

    return existing ?? path.resolve(workspaceRootCandidates[0], targetPath);
};

const envPath = workspaceRootCandidates
    .map((basePath) => path.resolve(basePath, '.env'))
    .find((candidate) => fs.existsSync(candidate));
dotenv.config(envPath ? { path: envPath } : undefined);

const app = express();
const port = Number(process.env.PORT ?? 3000);
const serviceAccountJson = process.env.FIREBASE_ADMIN_CREDENTIALS_JSON;
const serviceAccountPath = process.env.FIREBASE_ADMIN_CREDENTIALS;

type RawServiceAccount = {
    project_id?: string;
    client_email?: string;
    private_key?: string;
    private_key_id?: string;
};

const normalizeServiceAccount = (raw: RawServiceAccount): admin.ServiceAccount => ({
    projectId: raw.project_id ?? '',
    clientEmail: raw.client_email ?? '',
    privateKey: (raw.private_key ?? '').replace(/\\n/g, '\n'),
});

const loadServiceAccount = (): { value: admin.ServiceAccount; source: string } => {
    if (serviceAccountJson) {
        const parsed = JSON.parse(serviceAccountJson) as RawServiceAccount;
        return {
            value: normalizeServiceAccount(parsed),
            source: 'FIREBASE_ADMIN_CREDENTIALS_JSON',
        };
    }

    if (!serviceAccountPath) {
        throw new Error('Set FIREBASE_ADMIN_CREDENTIALS_JSON or FIREBASE_ADMIN_CREDENTIALS');
    }

    const resolvedServiceAccountPath = resolveWorkspacePath(serviceAccountPath);
    const parsed = JSON.parse(fs.readFileSync(resolvedServiceAccountPath, 'utf8')) as RawServiceAccount;
    return {
        value: normalizeServiceAccount(parsed),
        source: `FIREBASE_ADMIN_CREDENTIALS (${resolvedServiceAccountPath})`,
    };
};

if (!admin.apps.length) {
    const { value: serviceAccount, source } = loadServiceAccount();
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
    });
    console.log(`[firebase-admin] Loaded credentials from ${source}`);
    console.log('[firebase-admin] credential summary:', {
        projectId: serviceAccount.projectId,
        clientEmail: serviceAccount.clientEmail,
        privateKeyId: (() => {
            if (serviceAccountJson) {
                const parsed = JSON.parse(serviceAccountJson) as RawServiceAccount;
                return parsed.private_key_id ?? null;
            }
            if (serviceAccountPath) {
                const resolvedServiceAccountPath = resolveWorkspacePath(serviceAccountPath);
                const parsed = JSON.parse(
                    fs.readFileSync(resolvedServiceAccountPath, 'utf8'),
                ) as RawServiceAccount;
                return parsed.private_key_id ?? null;
            }
            return null;
        })(),
    });
}

const db = admin.firestore();
const bucket = admin.storage().bucket();

const runStartupFirestoreCheck = async (): Promise<void> => {
    try {
        await db.collection('system').limit(1).get();
        console.log('[firebase-admin] startup firestore check: ok');
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        console.error('[firebase-admin] startup firestore check failed:', message);
    }
};

await runStartupFirestoreCheck();

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
    res.send('Hello World!');
});

app.use(healthRoutesModule.createHealthRouter(db));
app.use(reportsRoutesModule.createReportsRouter(db, bucket));

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
