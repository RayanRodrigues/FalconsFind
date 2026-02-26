import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import request from 'supertest';
import { createRootRouter } from '../../dist/src/routes/root.routes.js';
import { errorHandler, notFoundHandler } from '../../dist/src/middleware/error-handler.js';

test('GET / returns API landing HTML with docs and health links', async () => {
  const app = express();
  app.use(createRootRouter('/api/v1'));
  app.use(notFoundHandler);
  app.use(errorHandler);

  const response = await request(app).get('/');

  assert.equal(response.status, 200);
  assert.match(response.headers['content-type'] ?? '', /text\/html/i);
  assert.match(response.text, /FalconFind API/i);
  assert.match(response.text, /\/api\/docs/);
  assert.match(response.text, /\/api\/v1\/health/);
});
