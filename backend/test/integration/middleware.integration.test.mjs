import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import cors from 'cors';
import request from './request-helper.mjs';
import { errorHandler, notFoundHandler } from '../../dist/src/middleware/error-handler.js';
import { HttpError } from '../../dist/src/routes/route-utils.js';
import { uploadSinglePhoto } from '../../dist/src/routes/report-photo-upload.js';

test('Express 5 async route throws are forwarded to the global error handler', async () => {
  const app = express();

  app.get('/boom', async () => {
    throw new HttpError(418, 'ASYNC_THROWN', 'Async route failure');
  });

  app.use(notFoundHandler);
  app.use(errorHandler);

  const response = await request(app).get('/boom');

  assert.equal(response.status, 418);
  assert.equal(response.body.error.code, 'ASYNC_THROWN');
  assert.equal(response.body.error.message, 'Async route failure');
});

test('Blocked CORS origins are mapped to a controlled JSON error under Express 5', async () => {
  const app = express();

  app.use(cors({
    origin(origin, callback) {
      if (!origin || origin === 'http://allowed.example') {
        callback(null, true);
        return;
      }

      callback(new HttpError(403, 'CORS_NOT_ALLOWED', 'CORS origin not allowed'));
    },
  }));
  app.get('/ping', (_req, res) => {
    res.json({ ok: true });
  });
  app.use(notFoundHandler);
  app.use(errorHandler);

  const response = await request(app)
    .get('/ping')
    .set('Origin', 'http://blocked.example');

  assert.equal(response.status, 403);
  assert.equal(response.body.error.code, 'CORS_NOT_ALLOWED');
  assert.equal(response.body.error.message, 'CORS origin not allowed');
});

test('Multer upload errors still reach the global error handler under Express 5', async () => {
  const app = express();

  app.post('/upload', uploadSinglePhoto, (_req, res) => {
    res.status(204).end();
  });
  app.use(notFoundHandler);
  app.use(errorHandler);

  const tooLargeBuffer = Buffer.alloc((5 * 1024 * 1024) + 1, 0xff);
  const response = await request(app)
    .post('/upload')
    .attach('photo', tooLargeBuffer, {
      filename: 'too-large.jpg',
      contentType: 'image/jpeg',
    });

  assert.equal(response.status, 400);
  assert.equal(response.body.error.code, 'BAD_REQUEST');
  assert.match(response.body.error.message, /file too large/i);
});
