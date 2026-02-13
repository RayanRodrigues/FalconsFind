import { Router, type Response } from 'express';
import type { Firestore } from 'firebase-admin/firestore';
import type { ErrorResponse } from '../contracts/index.js';

const apiPrefix = '/api/v1';

const sendError = (res: Response, status: number, code: string, message: string): void => {
  const payload: ErrorResponse = {
    error: {
      code,
      message,
    },
  };
  res.status(status).json(payload);
};

export const createHealthRouter = (db: Firestore): Router => {
  const router = Router();

  router.get(`${apiPrefix}/health`, (_req, res) => {
    res.json({ ok: true, service: 'backend' });
  });

  router.get(`${apiPrefix}/health/firebase`, async (_req, res) => {
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
