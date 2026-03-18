import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import request from './request-helper.mjs';
import { createAuthRouter } from '../../dist/src/routes/auth.routes.js';
import { errorHandler, notFoundHandler } from '../../dist/src/middleware/error-handler.js';

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

const buildTestApp = (authService, options = {}) => {
  const app = express();
  app.use(express.json());
  app.use(createAuthRouter(createFakeDb(), null, authService, options));
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
};

test('POST /api/v1/auth/login returns tokens and staff role on success', async () => {
  const authService = {
    InvalidLoginCredentialsError: class InvalidLoginCredentialsError extends Error {},
    LoginConfigurationError: class LoginConfigurationError extends Error {},
    LoginForbiddenError: class LoginForbiddenError extends Error {},
    loginStaffUser: async (_db, payload) => ({
      idToken: 'id-token',
      refreshToken: 'refresh-token',
      expiresIn: 3600,
      user: {
        uid: 'uid-123',
        email: payload.email,
        role: 'SECURITY',
      },
    }),
  };

  const response = await request(buildTestApp(authService))
    .post('/api/v1/auth/login')
    .send({
      email: 'security-success@fanshawe.ca',
      password: 'secret',
    });

  assert.equal(response.status, 200);
  assert.equal(response.body.user.email, 'security-success@fanshawe.ca');
  assert.equal(response.body.user.role, 'SECURITY');
  assert.equal(response.body.idToken, 'id-token');
});

test('POST /api/v1/auth/login returns 401 for invalid credentials', async () => {
  class InvalidLoginCredentialsError extends Error {}
  const authService = {
    InvalidLoginCredentialsError,
    LoginConfigurationError: class LoginConfigurationError extends Error {},
    LoginForbiddenError: class LoginForbiddenError extends Error {},
    loginStaffUser: async () => {
      throw new InvalidLoginCredentialsError('Invalid email or password');
    },
  };

  const response = await request(buildTestApp(authService))
    .post('/api/v1/auth/login')
    .send({
      email: 'security-invalid@fanshawe.ca',
      password: 'wrong',
    });

  assert.equal(response.status, 401);
  assert.equal(response.body.error.code, 'INVALID_CREDENTIALS');
});

test('POST /api/v1/auth/login locks repeated failed attempts', async () => {
  class InvalidLoginCredentialsError extends Error {}
  const authService = {
    InvalidLoginCredentialsError,
    LoginConfigurationError: class LoginConfigurationError extends Error {},
    LoginForbiddenError: class LoginForbiddenError extends Error {},
    loginStaffUser: async () => {
      throw new InvalidLoginCredentialsError('Invalid email or password');
    },
  };

  const app = buildTestApp(authService);

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const response = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: 'security-locked@fanshawe.ca',
        password: 'wrong',
      });

    assert.equal(response.status, 401);
  }

  const lockedResponse = await request(app)
    .post('/api/v1/auth/login')
    .send({
      email: 'security-locked@fanshawe.ca',
      password: 'wrong',
    });

  assert.equal(lockedResponse.status, 429);
  assert.equal(lockedResponse.body.error.code, 'AUTH_LOCKED');
  assert.ok(lockedResponse.headers['retry-after']);
});

test('POST /api/v1/auth/login returns 403 for non-staff accounts', async () => {
  class LoginForbiddenError extends Error {}
  const authService = {
    InvalidLoginCredentialsError: class InvalidLoginCredentialsError extends Error {},
    LoginConfigurationError: class LoginConfigurationError extends Error {},
    LoginForbiddenError,
    loginStaffUser: async () => {
      throw new LoginForbiddenError('Only staff accounts can sign in here');
    },
  };

  const response = await request(buildTestApp(authService))
    .post('/api/v1/auth/login')
    .send({
      email: 'student@example.com',
      password: 'secret',
    });

  assert.equal(response.status, 403);
  assert.equal(response.body.error.code, 'FORBIDDEN');
});

test('POST /api/v1/auth/logout revokes the current staff session', async () => {
  const revokedUids = [];
  const authService = {
    InvalidLoginCredentialsError: class InvalidLoginCredentialsError extends Error {},
    LoginConfigurationError: class LoginConfigurationError extends Error {},
    LoginForbiddenError: class LoginForbiddenError extends Error {},
    loginStaffUser: async () => {
      throw new Error('not used');
    },
    revokeStaffSession: async (uid) => {
      revokedUids.push(uid);
    },
  };

  const response = await request(buildTestApp(authService, {
    requireStaffUser: (_req, res, next) => {
      res.locals.authUser = { uid: 'uid-logout-1', role: 'ADMIN' };
      next();
    },
  }))
    .post('/api/v1/auth/logout')
    .send();

  assert.equal(response.status, 204);
  assert.deepEqual(revokedUids, ['uid-logout-1']);
});
