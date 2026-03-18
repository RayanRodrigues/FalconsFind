import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import cors from 'cors';
import request from './request-helper.mjs';
import { errorHandler, notFoundHandler } from '../../dist/src/middleware/error-handler.js';
import { createRequireStaffRoles } from '../../dist/src/middleware/require-staff-user.js';
import { UserRole } from '../../dist/src/contracts/index.js';
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

const createFakeDb = (users = {}) => ({
  collection: (name) => {
    assert.equal(name, 'users');
    return {
      doc: (id) => ({
        get: async () => ({
          exists: users[id] !== undefined,
          data: () => users[id],
        }),
      }),
    };
  },
});

test('Staff middleware rejects missing bearer tokens', async () => {
  const app = express();
  const requireStaff = createRequireStaffRoles(createFakeDb(), [UserRole.ADMIN, UserRole.SECURITY], {
    verifyIdToken: async () => ({ uid: 'ignored' }),
  });

  app.get('/admin-only', requireStaff, (_req, res) => {
    res.json({ ok: true });
  });
  app.use(notFoundHandler);
  app.use(errorHandler);

  const response = await request(app).get('/admin-only');

  assert.equal(response.status, 401);
  assert.equal(response.body.error.code, 'AUTHENTICATION_REQUIRED');
});

test('Staff middleware rejects authenticated users without staff role', async () => {
  const app = express();
  const requireStaff = createRequireStaffRoles(createFakeDb({ 'uid-student': { role: 'STUDENT' } }), [UserRole.ADMIN, UserRole.SECURITY], {
    verifyIdToken: async () => ({ uid: 'uid-student', email: 'student@example.com' }),
  });

  app.get('/admin-only', requireStaff, (_req, res) => {
    res.json({ ok: true });
  });
  app.use(notFoundHandler);
  app.use(errorHandler);

  const response = await request(app)
    .get('/admin-only')
    .set('Authorization', 'Bearer valid-token');

  assert.equal(response.status, 403);
  assert.equal(response.body.error.code, 'FORBIDDEN');
});

test('Staff middleware allows staff tokens and preserves role from token claims', async () => {
  const app = express();
  const requireStaff = createRequireStaffRoles(createFakeDb(), [UserRole.ADMIN, UserRole.SECURITY], {
    verifyIdToken: async () => ({
      uid: 'uid-security',
      email: 'security@example.com',
      role: UserRole.SECURITY,
    }),
  });

  app.get('/admin-only', requireStaff, (_req, res) => {
    res.json(res.locals.authUser);
  });
  app.use(notFoundHandler);
  app.use(errorHandler);

  const response = await request(app)
    .get('/admin-only')
    .set('Authorization', 'Bearer valid-token');

  assert.equal(response.status, 200);
  assert.equal(response.body.uid, 'uid-security');
  assert.equal(response.body.role, UserRole.SECURITY);
});

test('Staff middleware rejects revoked tokens', async () => {
  const app = express();
  const requireStaff = createRequireStaffRoles(createFakeDb(), [UserRole.ADMIN, UserRole.SECURITY], {
    verifyIdToken: async () => {
      const error = new Error('revoked');
      Object.assign(error, { code: 'auth/id-token-revoked' });
      throw error;
    },
  });

  app.get('/admin-only', requireStaff, (_req, res) => {
    res.json({ ok: true });
  });
  app.use(notFoundHandler);
  app.use(errorHandler);

  const response = await request(app)
    .get('/admin-only')
    .set('Authorization', 'Bearer revoked-token');

  assert.equal(response.status, 401);
  assert.equal(response.body.error.code, 'AUTH_TOKEN_REVOKED');
});
