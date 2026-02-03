import 'dotenv/config';
import express from 'express';
import fs from 'node:fs';
import admin from 'firebase-admin';

const app = express();
const port = 3000;

const serviceAccountPath = process.env.FIREBASE_ADMIN_CREDENTIALS;

if (!serviceAccountPath) {
    throw new Error('FIREBASE_ADMIN_CREDENTIALS is not set');
}

if (!admin.apps.length) {
    const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
    });
}

const db = admin.firestore();

app.get('/', (req, res) => {
    res.send('Hello World!');
});

app.get('/health', (req, res) => {
    res.json({ ok: true, service: 'backend' });
});

app.get('/health/firebase', async (req, res) => {
    try {
        const snapshot = await db.collection('health').doc('ping').get();
        res.json({
            ok: true,
            firebase: true,
            exists: snapshot.exists,
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        res.status(500).json({ ok: false, firebase: false, error: message });
    }
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
