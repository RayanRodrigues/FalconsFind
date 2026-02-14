import { Router } from 'express';
import type { Firestore } from 'firebase-admin/firestore';
import { API_PREFIX, sendError } from './route-utils.js';

export const createHealthRouter = (db: Firestore): Router => {
  const router = Router();

  router.get(`${API_PREFIX}/health`, (_req, res) => {
    res.json({ ok: true, service: 'backend' });
  });

  router.get(`${API_PREFIX}/health/firebase`, async (_req, res) => {
    try {
      const snapshot = await db.collection('system').doc('health').get();
      if (!snapshot.exists) {
        sendError(res, 404, 'NOT_FOUND', 'health doc not found');
        return;
      }

      res.json({
        ok: true,
        firebase: true,
        data: snapshot.data(),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      sendError(res, 500, 'INTERNAL_SERVER_ERROR', message);
    }
  });

  return router;
};
