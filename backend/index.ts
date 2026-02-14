import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import cors from 'cors';
import swaggerUi from 'swagger-ui-express';
import { loadEnvironment } from './src/bootstrap/runtime-paths.js';
import { importRuntimeModule } from './src/bootstrap/runtime-module.js';
import { initializeFirebaseServices, runStartupFirestoreCheck } from './src/bootstrap/firebase.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

loadEnvironment(__dirname);

const app = express();
const port = Number(process.env.PORT ?? 3000);
const { db, bucket } = initializeFirebaseServices(__dirname);
await runStartupFirestoreCheck(db);

app.use(cors());
app.use(express.json());
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(openApiModule.openApiDocument));

app.get('/', (_req, res) => {
  res.send('Hello World!');
});

app.use(healthRoutesModule.createHealthRouter(db));
app.use(reportsRoutesModule.createReportsRouter(db, bucket));

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
