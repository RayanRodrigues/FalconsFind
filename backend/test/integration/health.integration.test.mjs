import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import request from './request-helper.mjs';
import { createHealthRouter } from '../../dist/src/routes/health.routes.js';
import { errorHandler, notFoundHandler } from '../../dist/src/middleware/error-handler.js';

const buildHealthApp = (healthDoc) => {
  const db = {
    collection: (name) => {
      assert.equal(name, 'system');
      return {
        doc: (id) => {
          assert.equal(id, 'health');
          return {
            get: async () => ({
              exists: healthDoc !== undefined,
              data: () => healthDoc,
            }),
          };
        },
      };
    },
  };

  const app = express();
  app.use(createHealthRouter(db));
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
};

test('GET /api/v1/health/firebase returns connectivity status without exposing the raw health document', async () => {
  const app = buildHealthApp({ secret: 'should-not-leak', checkedAt: '2026-04-01T00:00:00.000Z' });

  const response = await request(app).get('/api/v1/health/firebase');

  assert.equal(response.status, 200);
  assert.equal(response.body.ok, true);
  assert.equal(response.body.firebase, true);
  assert.equal('data' in response.body, false);
});
