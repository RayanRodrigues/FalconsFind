import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import cors from 'cors';
import swaggerUi from 'swagger-ui-express';
import { loadEnvironment } from './src/bootstrap/runtime-paths.js';
import { importRuntimeModule } from './src/bootstrap/runtime-module.js';
import { initializeFirebaseServices, runStartupFirestoreCheck } from './src/bootstrap/firebase.js';
import { getAppConfig } from './src/config/env.js';
import { errorHandler, notFoundHandler } from './src/middleware/error-handler.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
loadEnvironment(__dirname);
const appConfig = getAppConfig();

const healthRoutesModule = await importRuntimeModule<{
  createHealthRouter: (db: FirebaseFirestore.Firestore) => express.Router;
}>(__dirname, './src/routes/health.routes');

const reportsRoutesModule = await importRuntimeModule<{
  createReportsRouter: (
    db: FirebaseFirestore.Firestore,
    bucket: unknown,
  ) => express.Router;
}>(__dirname, './src/routes/reports.routes');

const openApiModule = await importRuntimeModule<{
  openApiDocument: object;
}>(__dirname, './src/docs/openapi');

const app = express();
const { db, bucket } = initializeFirebaseServices(__dirname);
await runStartupFirestoreCheck(db);

app.use(cors());
app.use(express.json());
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(openApiModule.openApiDocument));

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'backend' });
});

app.use(healthRoutesModule.createHealthRouter(db));
app.use(reportsRoutesModule.createReportsRouter(db, bucket));
app.use(notFoundHandler);
app.use(errorHandler);

app.listen(appConfig.port, () => {
  console.log(`Server running at http://localhost:${appConfig.port}`);
});
