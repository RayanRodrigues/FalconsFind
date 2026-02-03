import 'dotenv/config';
import express from 'express';
import cors from 'cors';
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

app.use(cors());

app.get('/', (req, res) => {
    res.send('Hello World!');
});

app.get('/health', (req, res) => {
    res.json({ ok: true, service: 'backend' });
});

app.get('/health/firebase', async (req, res) => {
    try {
        const snapshot = await db.collection('system').doc('health').get();
        if (!snapshot.exists) {
            res.status(404).json({ ok: false, firebase: false, error: 'health doc not found' });
            return;
        }
        res.json({
            ok: true,
            firebase: true,
            data: snapshot.data(),
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        res.status(500).json({ ok: false, firebase: false, error: message });
    }
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
