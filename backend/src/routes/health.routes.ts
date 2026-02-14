import { Router } from 'express';
import type { Firestore } from 'firebase-admin/firestore';
import { API_PREFIX, HttpError } from './route-utils.js';

export const createHealthRouter = (db: Firestore): Router => {
  const router = Router();

  router.get(`${API_PREFIX}/health`, (_req, res) => {
    res.json({ ok: true, service: 'backend' });
  });

  router.get(`${API_PREFIX}/health/firebase`, async (_req, res) => {
    const snapshot = await db.collection('system').doc('health').get();
    if (!snapshot.exists) {
      throw new HttpError(404, 'NOT_FOUND', 'health doc not found');
    }

    res.json({
      ok: true,
      firebase: true,
      data: snapshot.data(),
    });
  });

  return router;
};
