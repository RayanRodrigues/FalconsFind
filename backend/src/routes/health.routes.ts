import { Router } from 'express';
import type { Firestore } from 'firebase-admin/firestore';
import { createJsonRateLimiter } from './rate-limit.js';
import { API_PREFIX, HttpError } from './route-utils.js';

export const createHealthRouter = (db: Firestore): Router => {
  const router = Router();
  const healthLimiter = createJsonRateLimiter({
    windowMs: 60 * 1000,
    limit: 60,
    message: 'Too many health-check requests. Please try again later.',
  });

  router.get(`${API_PREFIX}/health`, healthLimiter, (_req, res) => {
    res.json({ ok: true, service: 'backend' });
  });

  router.get(`${API_PREFIX}/health/firebase`, healthLimiter, async (_req, res) => {
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
