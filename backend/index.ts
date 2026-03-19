import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import cors from 'cors';
import swaggerUi from 'swagger-ui-express';
import { loadEnvironment } from './src/bootstrap/runtime-paths.js';
import { importRuntimeModule } from './src/bootstrap/runtime-module.js';
import { initializeFirebaseServices, runStartupFirestoreCheck } from './src/bootstrap/firebase.js';
import { createRedisClient } from './src/bootstrap/redis.js';
import { getAppConfig } from './src/config/env.js';
import { errorHandler, notFoundHandler } from './src/middleware/error-handler.js';
import { HttpError } from './src/routes/route-utils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
loadEnvironment(__dirname);
const appConfig = getAppConfig();
const backendPublicDirCandidates = [
  path.resolve(__dirname, './public'),
  path.resolve(process.cwd(), 'backend/public'),
];
const backendPublicDir = backendPublicDirCandidates.find((candidate) => fs.existsSync(candidate));
const faviconPath = backendPublicDir ? path.join(backendPublicDir, 'favicon.ico') : null;

const healthRoutesModule = await importRuntimeModule<{
  createHealthRouter: (db: FirebaseFirestore.Firestore) => express.Router;
}>(__dirname, './src/routes/health.routes');

const rootRoutesModule = await importRuntimeModule<{
  createRootRouter: (apiPrefix: string) => express.Router;
}>(__dirname, './src/routes/root.routes');

const itemsRoutesModule = await importRuntimeModule<{
  createItemsRouter: (
    db: FirebaseFirestore.Firestore,
    bucket: unknown,
    redis: unknown,
  ) => express.Router;
}>(__dirname, './src/routes/items.routes');

const authRoutesModule = await importRuntimeModule<{
  createAuthRouter: (
    db: FirebaseFirestore.Firestore,
    redis: unknown,
  ) => express.Router;
}>(__dirname, './src/routes/auth.routes');

const reportsRoutesModule = await importRuntimeModule<{
  createReportsRouter: (
    db: FirebaseFirestore.Firestore,
    bucket: unknown,
  ) => express.Router;
}>(__dirname, './src/routes/reports.routes');

const claimsRoutesModule = await importRuntimeModule<{
  createClaimsRouter: (
    db: FirebaseFirestore.Firestore,
    bucket: unknown,
  ) => express.Router;
}>(__dirname, './src/routes/claims.routes');

const openApiModule = await importRuntimeModule<{
  openApiDocument: object;
}>(__dirname, './src/docs/openapi');

const app = express();
const { db, bucket } = initializeFirebaseServices(__dirname);
await runStartupFirestoreCheck(db);
const redis = await createRedisClient(appConfig.redisUrl);

app.use(
  cors({
    origin(origin, callback) {
      if (!origin) {
        callback(null, true);
        return;
      }

      if (appConfig.corsAllowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }

      callback(new HttpError(403, 'CORS_NOT_ALLOWED', 'CORS origin not allowed'));
    },
  }),
);
app.use(express.json({ limit: '50kb' }));
if (appConfig.enableSwagger) {
  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(openApiModule.openApiDocument));
}
if (backendPublicDir) {
  app.use(express.static(backendPublicDir, {
    index: false,
    fallthrough: true,
  }));
}
app.get('/favicon.ico', (_req, res) => {
  if (!faviconPath) {
    res.sendStatus(404);
    return;
  }

  res.type('image/x-icon');
  res.sendFile(faviconPath);
});
app.get(`${appConfig.apiPrefix}/favicon.ico`, (_req, res) => {
  if (!faviconPath) {
    res.sendStatus(404);
    return;
  }

  res.type('image/x-icon');
  res.sendFile(faviconPath);
});
app.use(rootRoutesModule.createRootRouter(appConfig.apiPrefix));

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'backend' });
});


app.use(healthRoutesModule.createHealthRouter(db));
app.use(authRoutesModule.createAuthRouter(db, redis));
app.use(reportsRoutesModule.createReportsRouter(db, bucket));
app.use(claimsRoutesModule.createClaimsRouter(db, bucket));
app.use(itemsRoutesModule.createItemsRouter(db, bucket, redis));
app.use(notFoundHandler);
app.use(errorHandler);

app.listen(appConfig.port, () => {
  console.log(
    `Environment: ${appConfig.appEnv} | Public API base: ${appConfig.apiBaseUrl}${appConfig.apiPrefix}`,
  );
  console.log(`CORS allowed origins: ${appConfig.corsAllowedOrigins.join(', ') || '(none)'}`);
});
